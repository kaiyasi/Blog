import type { APIRoute } from 'astro';
import { createDiscordState, discordOAuthConfig } from '../../../../../server/community-avatar';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const { clientId, clientSecret } = discordOAuthConfig();
  if (!clientId || !clientSecret) return new Response('Discord OAuth is not configured.', { status: 503 });
  const { state, cookie } = createDiscordState(request);
  const origin = new URL(request.url).origin;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/community/avatar/discord/callback`;
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('state', state);
  return new Response(null, { status: 302, headers: { Location: authorize.href, 'Set-Cookie': cookie } });
};
