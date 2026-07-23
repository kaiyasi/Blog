import type { APIRoute } from 'astro';
import { adminConfigured, clearAdminSessionCookie, createAdminSessionCookie, validAdminPassword } from '../../../server/admin-auth';
import { communityJson, rateLimited, sameOrigin } from '../../../server/community-http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!adminConfigured()) return communityJson({ error: 'admin_not_configured' }, 503);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return communityJson({ error: 'invalid_content_type' }, 415);
  }
  if (rateLimited(request, 'admin-login', 5, 15 * 60_000)) {
    return communityJson({ error: 'rate_limited' }, 429);
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return communityJson({ error: 'invalid_json' }, 400); }
  if (!validAdminPassword(payload.password)) return communityJson({ error: 'invalid_credentials' }, 401);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': createAdminSessionCookie(request),
    },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearAdminSessionCookie(request),
    },
  });
};
