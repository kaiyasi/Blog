import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type AvatarProvider = 'gravatar' | 'github' | 'discord';

export interface DiscordCommentIdentity {
  userId: string;
  displayName: string;
  avatarUrl: string;
  expiresAt: number;
}

const DISCORD_IDENTITY_COOKIE = 'comment_discord_identity';
const DISCORD_STATE_COOKIE = 'comment_discord_state';

declare global {
  var communitySessionSecret: string | undefined;
}

function sessionSecret() {
  if (process.env.COMMUNITY_SESSION_SECRET) return process.env.COMMUNITY_SESSION_SECRET;
  globalThis.communitySessionSecret ||= randomBytes(32).toString('hex');
  return globalThis.communitySessionSecret;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  const entry = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function signed(value: string) {
  const signature = createHmac('sha256', sessionSecret()).update(value).digest('base64url');
  return `${Buffer.from(value).toString('base64url')}.${signature}`;
}

function verified(value: string | null) {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const decoded = Buffer.from(payload, 'base64url').toString();
  const expected = createHmac('sha256', sessionSecret()).update(decoded).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return decoded;
}

function cookie(name: string, value: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function createDiscordState(request: Request) {
  const state = randomBytes(24).toString('base64url');
  return { state, cookie: cookie(DISCORD_STATE_COOKIE, state, request, 10 * 60) };
}

export function validDiscordState(request: Request, state: string | null) {
  const stored = cookieValue(request, DISCORD_STATE_COOKIE);
  if (!stored || !state || stored.length !== state.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(state));
}

export function clearDiscordStateCookie(request: Request) {
  return cookie(DISCORD_STATE_COOKIE, '', request, 0);
}

export function createDiscordIdentityCookie(request: Request, identity: DiscordCommentIdentity) {
  return cookie(DISCORD_IDENTITY_COOKIE, signed(JSON.stringify(identity)), request, 60 * 60);
}

export function readDiscordIdentity(request: Request): DiscordCommentIdentity | null {
  const payload = verified(cookieValue(request, DISCORD_IDENTITY_COOKIE));
  if (!payload) return null;
  try {
    const identity = JSON.parse(payload) as DiscordCommentIdentity;
    const url = new URL(identity.avatarUrl);
    if (!/^\d{17,20}$/.test(identity.userId) || identity.expiresAt < Date.now()
      || url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com') return null;
    return identity;
  } catch {
    return null;
  }
}

export function resolveCommentAvatar(request: Request, providerValue: unknown, identityValue: unknown) {
  const provider = typeof providerValue === 'string' ? providerValue : '';
  const identity = typeof identityValue === 'string' ? identityValue.trim() : '';
  if (provider === 'gravatar') {
    if (!/^\S+@\S+\.\S+$/.test(identity) || identity.length > 160) return null;
    const hash = createHash('sha256').update(identity.toLowerCase()).digest('hex');
    return { avatarProvider: provider, avatarUrl: `https://gravatar.com/avatar/${hash}?s=160&d=identicon&r=g` };
  }
  if (provider === 'github') {
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(identity)) return null;
    return { avatarProvider: provider, avatarUrl: `https://github.com/${identity}.png?size=160` };
  }
  if (provider === 'discord') {
    const discord = readDiscordIdentity(request);
    if (!discord) return null;
    return { avatarProvider: provider, avatarUrl: discord.avatarUrl };
  }
  return null;
}

export const discordOAuthConfig = () => ({
  clientId: process.env.DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
});
