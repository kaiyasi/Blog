import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ENTRY_COOKIE = 'kaiyasi_admin_entry';
const ENTRY_SECONDS = 5 * 60;

interface AdminEntryGrant {
  expiresAt: number;
  nonce: string;
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET || import.meta.env.ADMIN_SESSION_SECRET
    || process.env.COMMUNITY_SESSION_SECRET || import.meta.env.COMMUNITY_SESSION_SECRET || '';
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  const entry = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(`admin-entry:${payload}`).digest('base64url');
}

function isSecureRequest(request: Request) {
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return forwardedProtocol === 'https' || new URL(request.url).protocol === 'https:';
}

export function adminEntryPath() {
  const value = (process.env.ADMIN_ENTRY_PATH || import.meta.env.ADMIN_ENTRY_PATH || '').trim();
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return /^\/[a-z0-9][a-z0-9-]{7,63}$/i.test(normalized) && normalized !== '/admin' ? normalized : '';
}

export function createAdminEntryCookie(request: Request) {
  const grant: AdminEntryGrant = {
    expiresAt: Date.now() + ENTRY_SECONDS * 1000,
    nonce: randomBytes(18).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${ENTRY_COOKIE}=${encodeURIComponent(`${payload}.${signature(payload)}`)}; Path=/; Max-Age=${ENTRY_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

export function hasAdminEntryGrant(request: Request) {
  if (!secret() || !adminEntryPath()) return false;
  const value = cookieValue(request, ENTRY_COOKIE);
  if (!value) return false;
  const [payload, provided] = value.split('.');
  if (!payload || !provided) return false;
  const expected = Buffer.from(signature(payload), 'base64url');
  let actual: Buffer;
  try { actual = Buffer.from(provided, 'base64url'); } catch { return false; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminEntryGrant;
    return typeof grant.nonce === 'string' && grant.nonce.length >= 20 && grant.expiresAt > Date.now();
  } catch {
    return false;
  }
}
