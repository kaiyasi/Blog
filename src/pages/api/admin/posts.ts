import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { communityJson, sameOrigin } from '../../../server/community-http';
import { AdminPostError, createAdminPost, getAdminPost, listAdminPosts, updateAdminPost } from '../../../server/admin-posts';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof AdminPostError) return communityJson({ error: error.code }, error.status);
  console.error('Admin post operation failed', error);
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
    if (slug) return communityJson({ post: await getAdminPost(slug) });
    const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('zh-Hant').slice(0, 120);
    const status = url.searchParams.get('status');
    const requestedPage = Number.parseInt(url.searchParams.get('page') || '1', 10);
    const requestedPageSize = Number.parseInt(url.searchParams.get('pageSize') || '25', 10);
    const pageSize = Number.isFinite(requestedPageSize) ? Math.min(50, Math.max(10, requestedPageSize)) : 25;
    const allPosts = await listAdminPosts();
    const counts = {
      all: allPosts.length,
      published: allPosts.filter(post => !post.draft).length,
      draft: allPosts.filter(post => post.draft).length,
    };
    const filtered = allPosts.filter(post => {
      if (status === 'draft' && !post.draft) return false;
      if (status === 'published' && post.draft) return false;
      if (!query) return true;
      return `${post.title} ${post.slug} ${post.description} ${post.tags.join(' ')}`.toLocaleLowerCase('zh-Hant').includes(query);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
    const start = (page - 1) * pageSize;
    return communityJson({
      posts: filtered.slice(start, start + pageSize),
      pagination: { page, pageSize, total: filtered.length, totalPages, counts },
    });
  } catch (error) {
    return failure(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const rejected = writable(request);
  if (rejected) return rejected;
  try {
    return communityJson({ post: await createAdminPost(await request.json()) }, 201);
  } catch (error) {
    return failure(error instanceof SyntaxError ? new AdminPostError('invalid_json') : error);
  }
};

export const PUT: APIRoute = async ({ request, url }) => {
  const rejected = writable(request);
  if (rejected) return rejected;
  try {
    const slug = url.searchParams.get('slug') || '';
    return communityJson({ post: await updateAdminPost(slug, await request.json()) });
  } catch (error) {
    return failure(error instanceof SyntaxError ? new AdminPostError('invalid_json') : error);
  }
};
