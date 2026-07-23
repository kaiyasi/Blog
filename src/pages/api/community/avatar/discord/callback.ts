import type { APIRoute } from 'astro';
import {
  clearDiscordStateCookie, createDiscordIdentityCookie, discordOAuthConfig, validDiscordState,
  type DiscordCommentIdentity,
} from '../../../../../server/community-avatar';

export const prerender = false;

const popupHtml = (origin: string, payload: Record<string, unknown>) => {
  const message = JSON.stringify(payload).replaceAll('<', '\\u003c');
  const target = JSON.stringify(origin);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Discord</title></head><body><script>window.opener?.postMessage(${message},${target});window.close();</script></body></html>`;
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const { clientId, clientSecret } = discordOAuthConfig();
  if (!code || !validDiscordState(request, state) || !clientId || !clientSecret) {
    return new Response(popupHtml(origin, { type: 'comment-discord-error' }), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/community/avatar/discord/callback`;
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    if (!tokenResponse.ok) throw new Error(`Discord token returned ${tokenResponse.status}`);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error('Discord token was empty');
    const userResponse = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!userResponse.ok) throw new Error(`Discord user returned ${userResponse.status}`);
    const user = await userResponse.json() as { id: string; username: string; global_name?: string | null; avatar?: string | null; discriminator?: string };
    const defaultIndex = user.discriminator && user.discriminator !== '0'
      ? Number(user.discriminator) % 5
      : Number((BigInt(user.id) >> 22n) % 6n);
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=160`
      : `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    const identity: DiscordCommentIdentity = {
      userId: user.id,
      displayName: (user.global_name || user.username).slice(0, 80),
      avatarUrl,
      expiresAt: Date.now() + 60 * 60_000,
    };
    const response = new Response(popupHtml(origin, { type: 'comment-discord-connected', displayName: identity.displayName, avatarUrl }), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    response.headers.append('Set-Cookie', clearDiscordStateCookie(request));
    response.headers.append('Set-Cookie', createDiscordIdentityCookie(request, identity));
    return response;
  } catch (error) {
    console.error('[discord-comment-oauth]', error instanceof Error ? error.message : 'Unknown OAuth error');
    return new Response(popupHtml(origin, { type: 'comment-discord-error' }), { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
