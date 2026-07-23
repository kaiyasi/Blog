import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createComment, listComments } from '../../../server/community-store';
import { cleanText, communityJson, rateLimited, sameOrigin } from '../../../server/community-http';
import { resolveCommentAvatar } from '../../../server/community-avatar';

export const prerender = false;

const locales = new Set(['zh-TW', 'en', 'ja', 'ko']);
const resourcePattern = /^(about|post:[a-z0-9][a-z0-9._-]{0,119})$/;

async function resourceExists(resource: string) {
  if (resource === 'about') return true;
  if (!resource.startsWith('post:')) return false;
  const slug = resource.slice(5);
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.some(post => post.id === slug);
}

export const GET: APIRoute = async ({ request }) => {
  const resource = new URL(request.url).searchParams.get('resource') || '';
  if (!resourcePattern.test(resource) || !await resourceExists(resource)) {
    return communityJson({ error: 'resource_not_found' }, 404);
  }
  return communityJson({ comments: listComments(resource) });
};

export const POST: APIRoute = async ({ request }) => {
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return communityJson({ error: 'invalid_content_type' }, 415);
  }
  if (rateLimited(request, 'comment', 5, 10 * 60_000)) {
    return communityJson({ error: 'rate_limited' }, 429);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return communityJson({ error: 'invalid_json' }, 400);
  }

  const resource = cleanText(payload.resource);
  const author = cleanText(payload.author);
  const body = cleanText(payload.body);
  const locale = cleanText(payload.locale);
  const avatar = resolveCommentAvatar(request, payload.avatarProvider, payload.avatarIdentity);
  const honeypot = cleanText(payload.company);
  if (honeypot) return communityJson({ ok: true }, 201);
  if (!resourcePattern.test(resource) || !await resourceExists(resource)) {
    return communityJson({ error: 'resource_not_found' }, 404);
  }
  if (author.length < 2 || author.length > 40 || body.length < 2 || body.length > 1000
    || !locales.has(locale) || !avatar) {
    return communityJson({ error: 'invalid_input' }, 400);
  }

  return communityJson({ comment: createComment({ resource, author, body, locale, ...avatar }) }, 201);
};
