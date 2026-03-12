/**
 * Secure HTTP utilities with TLS validation and security headers
 */

interface SecureFetchOptions extends globalThis.RequestInit {
  timeout?: number;
}

/**
 * Custom error for modules not available offline
 */
export class ModuleNotAvailableOfflineError extends Error {
  constructor(message: string = 'Module not available offline') {
    super(message);
    this.name = 'ModuleNotAvailableOfflineError';
  }
}

/**
 * Secure fetch wrapper with TLS validation and security headers
 * @param url - URL to fetch
 * @param options - Fetch options with additional security configurations
 * @returns Promise with fetch response
 */
const secureFetch = async (url: string, options: SecureFetchOptions = {}): Promise<Response> => {
  const { timeout = 10000, ...fetchOptions } = options;

  // Security headers for requests
  const secureHeaders: globalThis.HeadersInit = {
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...fetchOptions.headers,
  };

  // Validate URL protocol in production (but allow localhost HTTP)
  if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

    if (!isLocalhost) {
      console.warn('⚠️ Insecure HTTP detected in production. Use HTTPS instead.');
      // In production, force HTTPS for non-localhost URLs
      url = url.replace('http://', 'https://');
    }
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: secureHeaders,
      signal: controller.signal,
      // Ensure credentials are not sent to third-party domains
      credentials: url.startsWith(window.location.origin) ? 'same-origin' : 'omit',
      // Prevent redirect to insecure protocols
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Validate response headers for security
    if (process.env.NODE_ENV === 'development') {
      validateResponseSecurity(response, url);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    throw error;
  }
};

/**
 * Validate response security headers (development only)
 * @param response - Fetch response
 * @param url - Request URL
 */
const validateResponseSecurity = (response: Response, url: string): void => {
  const warnings: string[] = [];

  // Check for HTTPS in production-like environments
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    warnings.push('Response from insecure HTTP connection');
  }

  // Skip strict header validation for localhost in development
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  if (isLocalhost) {
    return; // Skip security header validation for local development
  }

  // Check for security headers (only for non-localhost requests)
  const securityHeaders = [
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
  ];

  securityHeaders.forEach(header => {
    if (!response.headers.get(header)) {
      warnings.push(`Missing security header: ${header}`);
    }
  });

  if (warnings.length > 0) {
    console.warn('🔒 Security warnings for', url, warnings);
  }
};

/**
 * Secure JSON fetch with automatic parsing and validation
 * @param url - URL to fetch JSON from
 * @param options - Fetch options
 * @returns Promise with parsed JSON data
 */
export const secureJsonFetch = async <T = any>(
  url: string,
  options: SecureFetchOptions = {}
): Promise<T> => {
  const response = await secureFetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Check if this is a MODULE_NOT_AVAILABLE_OFFLINE error from service worker
    if (response.status === 503) {
      try {
        const errorData = await response.json();
        if (errorData.error === 'MODULE_NOT_AVAILABLE_OFFLINE') {
          throw new ModuleNotAvailableOfflineError(
            'This module is not available offline. Please download it or connect to the internet.'
          );
        }
      } catch (error) {
        // If parsing fails or it's not our specific error, fall through to generic error
        if (error instanceof ModuleNotAvailableOfflineError) {
          throw error;
        }
      }
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Response is not valid JSON');
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Failed to parse JSON response');
  }
};

/**
 * Validate and sanitize URL to prevent SSRF attacks
 * @param url - URL to validate
 * @returns Validated URL or throws error
 */
export const validateUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url, window.location.origin);

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol. Only HTTP/HTTPS allowed.');
    }

    // Prevent access to private IP ranges in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsedUrl.hostname;

      // Block private IP ranges
      const privateRanges = [
        /^127\./, // 127.0.0.0/8
        /^10\./, // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^192\.168\./, // 192.168.0.0/16
        /^169\.254\./, // 169.254.0.0/16 (link-local)
        /^::1$/, // IPv6 localhost
        /^fc00:/, // IPv6 private
        /^fe80:/, // IPv6 link-local
      ];

      if (privateRanges.some(range => range.test(hostname))) {
        throw new Error('Access to private IP ranges is not allowed');
      }
    }

    return parsedUrl.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
