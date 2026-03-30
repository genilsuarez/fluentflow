/**
 * Secure HTTP utilities
 */

/**
 * Custom error for modules not available offline
 */
export class ModuleNotAvailableOfflineError extends Error {
  constructor(message: string = 'Module not available offline') {
    super(message);
    this.name = 'ModuleNotAvailableOfflineError';
  }
}
