const APPS = ['deskflow', 'fluentflow', 'hubflow', 'lyricflow'] as const;
export type PlatformApp = (typeof APPS)[number];

const PRODUCTION_ORIGIN = 'https://genilsuarez.github.io';
const LOCAL_GATEWAY_PORT = '3000';

export function isLocalPlatformHost(): boolean {
  return (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.startsWith('192.168.')
  );
}

export function isSharedPlatformOrigin(): boolean {
  if (!isLocalPlatformHost()) return true;
  if (location.port !== LOCAL_GATEWAY_PORT) return false;
  return /^\/(deskflow|fluentflow|hubflow|lyricflow)(\/|$)/.test(location.pathname);
}

function localGatewayOrigin(): string {
  return `${location.protocol}//${location.hostname}:${LOCAL_GATEWAY_PORT}`;
}

function joinUrl(base: string, path: string): string {
  if (!path || path === '/') return base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`).toString();
}

export function appHref(app: PlatformApp, path = '/'): string {
  if (!APPS.includes(app)) return '/';
  if (isLocalPlatformHost()) return joinUrl(`${localGatewayOrigin()}/${app}/`, path);
  return joinUrl(`${PRODUCTION_ORIGIN}/${app}/`, path);
}

export function portalHref(): string {
  return appHref('deskflow');
}
