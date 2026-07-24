import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { validateAboutContent, AdminAboutError } from '../../../server/admin-about';
import { createAboutPreview } from '../../../server/admin-about-preview';
import { communityJson, sameOrigin } from '../../../server/community-http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return communityJson({ error: 'invalid_content_type' }, 415);
  try {
    const payload = await request.json() as { content?: unknown };
    const token = createAboutPreview(validateAboutContent(payload.content));
    return communityJson({ url: `/about?preview=${encodeURIComponent(token)}` });
  } catch (error) {
    if (error instanceof AdminAboutError) return communityJson({ error: error.code }, 422);
    return communityJson({ error: 'preview_failed' }, 422);
  }
};
