import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { AdminProjectError, createAdminProject, getAdminProject, listAdminProjects, updateAdminProject } from '../../../server/admin-projects';
import { communityJson, sameOrigin } from '../../../server/community-http';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof AdminProjectError) return communityJson({ error: error.code }, error.status);
  console.error('Admin project operation failed', error);
  return communityJson({ error: 'internal_error' }, 500);
}
function writable(request: Request) {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return communityJson({ error: 'invalid_content_type' }, 415);
  return null;
}
export const GET: APIRoute = async ({ request, url }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  try {
    const slug = url.searchParams.get('slug');
    return communityJson(slug ? { project: await getAdminProject(slug) } : { projects: await listAdminProjects() });
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async ({ request }) => {
  const rejected = writable(request); if (rejected) return rejected;
  try { return communityJson({ project: await createAdminProject(await request.json()) }, 201); } catch (error) { return failure(error instanceof SyntaxError ? new AdminProjectError('invalid_json') : error); }
};
export const PUT: APIRoute = async ({ request, url }) => {
  const rejected = writable(request); if (rejected) return rejected;
  try { return communityJson({ project: await updateAdminProject(url.searchParams.get('slug') || '', await request.json()) }); } catch (error) { return failure(error instanceof SyntaxError ? new AdminProjectError('invalid_json') : error); }
};
