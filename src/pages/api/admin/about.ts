import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { AdminAboutError, getAboutContent, updateAboutContent } from '../../../server/admin-about';
import { communityJson, sameOrigin } from '../../../server/community-http';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof AdminAboutError) return communityJson({ error: error.code }, error.status);
  console.error('Admin about operation failed', error);
  return communityJson({ error: 'internal_error' }, 500);
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  try {
    return communityJson({ content: await getAboutContent() });
  } catch (error) {
    return failure(error);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return communityJson({ error: 'invalid_content_type' }, 415);
  try {
    return communityJson({ content: await updateAboutContent(await request.json()) });
  } catch (error) {
    return failure(error instanceof SyntaxError ? new AdminAboutError('invalid_json') : error);
  }
};
