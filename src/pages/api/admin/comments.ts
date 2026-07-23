import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { communityJson, sameOrigin } from '../../../server/community-http';
import { listAdminComments, setCommentStatus } from '../../../server/community-store';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  return communityJson({ comments: listAdminComments() });
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return communityJson({ error: 'invalid_content_type' }, 415);
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return communityJson({ error: 'invalid_json' }, 400); }
  const id = typeof payload.id === 'string' ? payload.id : '';
  const status = payload.status === 'visible' || payload.status === 'hidden' ? payload.status : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !status) return communityJson({ error: 'invalid_input' }, 400);
  if (!setCommentStatus(id, status)) return communityJson({ error: 'not_found' }, 404);
  return communityJson({ ok: true, id, status });
};
