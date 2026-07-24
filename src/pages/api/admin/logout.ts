import type { APIRoute } from 'astro';
import { clearAdminSessionCookie } from '../../../server/admin-auth';
import { communityJson, sameOrigin } from '../../../server/community-http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return communityJson({ error: 'invalid_content_type' }, 415);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearAdminSessionCookie(request),
    },
  });
};
