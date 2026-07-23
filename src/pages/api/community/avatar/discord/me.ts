import type { APIRoute } from 'astro';
import { readDiscordIdentity } from '../../../../../server/community-avatar';
import { communityJson } from '../../../../../server/community-http';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const identity = readDiscordIdentity(request);
  return communityJson(identity ? { connected: true, displayName: identity.displayName, avatarUrl: identity.avatarUrl } : { connected: false });
};
