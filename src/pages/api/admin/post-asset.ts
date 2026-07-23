import type { APIRoute } from 'astro';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { communityJson } from '../../../server/community-http';

export const prerender = false;

const assetsDirectory = resolve(process.cwd(), 'src/assets/posts');
const types: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  const relative = url.searchParams.get('path') || '';
  if (!/^[a-zA-Z0-9_./-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(relative)) return communityJson({ error: 'invalid_path' }, 400);
  const path = resolve(assetsDirectory, relative);
  if (!path.startsWith(`${assetsDirectory}${sep}`)) return communityJson({ error: 'invalid_path' }, 400);
  try {
    if (!(await stat(path)).isFile()) return communityJson({ error: 'not_found' }, 404);
    return new Response(await readFile(path), {
      headers: {
        'Content-Type': types[extname(path).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return communityJson({ error: 'not_found' }, 404);
  }
};
