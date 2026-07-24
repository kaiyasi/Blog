import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ADMIN_COOKIE = 'kaiyasi_admin_session';
const SESSION_SECONDS = 12 * 60 * 60;

interface AdminSession {
  expiresAt: number;
  nonce: string;
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET || import.meta.env.ADMIN_SESSION_SECRET
    || process.env.COMMUNITY_SESSION_SECRET || import.meta.env.COMMUNITY_SESSION_SECRET || '';
}

function password() {
  return process.env.ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD || '';
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  const entry = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function isSecureRequest(request: Request) {
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return forwardedProtocol === 'https' || new URL(request.url).protocol === 'https:';
}

function cookie(request: Request, value: string, maxAge: number) {
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export function adminConfigured() {
  return Boolean(password() && secret().length >= 32);
}

export function validAdminPassword(value: unknown) {
  if (!adminConfigured() || typeof value !== 'string' || value.length > 256) return false;
  const actual = createHash('sha256').update(value).digest();
  const expected = createHash('sha256').update(password()).digest();
  return timingSafeEqual(actual, expected);
}

export function createAdminSessionCookie(request: Request) {
  const session: AdminSession = {
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
    nonce: randomBytes(18).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return cookie(request, `${payload}.${signature(payload)}`, SESSION_SECONDS);
}

export function clearAdminSessionCookie(request: Request) {
  return cookie(request, '', 0);
}

export function isAdminAuthenticated(request: Request) {
  if (!adminConfigured()) return false;
  const value = cookieValue(request, ADMIN_COOKIE);
  if (!value) return false;
  const [payload, provided] = value.split('.');
  if (!payload || !provided) return false;
  const expected = Buffer.from(signature(payload), 'base64url');
  let actual: Buffer;
  try { actual = Buffer.from(provided, 'base64url'); } catch { return false; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminSession;
    return typeof session.nonce === 'string' && session.nonce.length >= 20 && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}
