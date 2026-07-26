import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ENTRY_COOKIE = 'kaiyasi_admin_entry';
const ENTRY_SECONDS = 5 * 60;
const ENTRY_PREFIX = '/access-';

interface AdminEntryGrant {
  expiresAt: number;
  nonce: string;
  path: string;
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

function readGrant(request: Request): AdminEntryGrant | null {
  if (!secret()) return null;
  const value = cookieValue(request, ENTRY_COOKIE);
  if (!value) return null;
  const [payload, provided] = value.split('.');
  if (!payload || !provided) return null;
  const expected = Buffer.from(signature(payload), 'base64url');
  let actual: Buffer;
  try { actual = Buffer.from(provided, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminEntryGrant;
    if (typeof grant.nonce !== 'string' || grant.nonce.length < 20) return null;
    if (typeof grant.path !== 'string' || !grant.path.startsWith(ENTRY_PREFIX)) return null;
    return grant.expiresAt > Date.now() ? grant : null;
  } catch {
    return null;
  }
}

export function createAdminEntry(request: Request) {
  const nonce = randomBytes(24).toString('base64url');
  const grant: AdminEntryGrant = {
    expiresAt: Date.now() + ENTRY_SECONDS * 1000,
    nonce,
    path: `${ENTRY_PREFIX}${nonce}`,
  };
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return {
    location: grant.path,
    cookie: `${ENTRY_COOKIE}=${encodeURIComponent(`${payload}.${signature(payload)}`)}; Path=/; Max-Age=${ENTRY_SECONDS}; HttpOnly; SameSite=Strict${secure}`,
  };
}

export function clearAdminEntryCookie(request: Request) {
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${ENTRY_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

export function adminEntryPath(request: Request) {
  return readGrant(request)?.path || '';
}

export function hasAdminEntryGrant(request: Request, pathname: string) {
  return adminEntryPath(request) === pathname;
}
