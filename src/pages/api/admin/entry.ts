import type { APIRoute } from 'astro';
import { createAdminEntry } from '../../../server/admin-entry';
import { adminConfigured } from '../../../server/admin-auth';
import { communityJson, rateLimited, sameOrigin } from '../../../server/community-http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!adminConfigured()) return communityJson({ error: 'admin_not_configured' }, 503);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return communityJson({ error: 'invalid_content_type' }, 415);
  }
  if (rateLimited(request, 'admin-entry', 6, 60_000)) {
    return communityJson({ error: 'rate_limited' }, 429);
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return communityJson({ error: 'invalid_json' }, 400); }
  const clicks = payload.clicks;
  const elapsedMs = payload.elapsedMs;
  if (clicks !== 10 || typeof elapsedMs !== 'number' || elapsedMs < 0 || elapsedMs > 4_000) {
    return communityJson({ error: 'invalid_sequence' }, 400);
  }
  const entry = createAdminEntry(request);
  return new Response(JSON.stringify({ location: entry.location }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': entry.cookie,
    },
  });
};
