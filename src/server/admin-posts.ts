import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { load, dump } from 'js-yaml';
import { ContentSyncError, syncContentFile } from './content-sync';

const postsDirectory = resolve(process.env.CONTENT_POSTS_DIRECTORY || process.cwd(), process.env.CONTENT_POSTS_DIRECTORY ? '' : 'src/content/posts');
const slugPattern = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/;
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const supportedExtensions = new Set(['.md', '.mdx']);

export interface AdminPostInput {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  copyright: boolean;
  cover?: string;
  body: string;
}

export interface AdminPost extends AdminPostInput {
  extension: '.md' | '.mdx';
  updatedAt: string;
}

export class AdminPostError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

function containedPath(path: string) {
  const absolute = resolve(postsDirectory, path);
  if (absolute !== postsDirectory && !absolute.startsWith(`${postsDirectory}${sep}`)) {
    throw new AdminPostError('invalid_slug');
  }
  return absolute;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value) return value;
  }
  throw new AdminPostError('invalid_date');
}

function parseTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags = [...new Set(value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean))];
  if (tags.length > 20 || tags.some(tag => tag.length > 40)) throw new AdminPostError('invalid_tags');
  return tags;
}

function validateInput(value: unknown): AdminPostInput {
  if (!value || typeof value !== 'object') throw new AdminPostError('invalid_input');
  const input = value as Record<string, unknown>;
  const slug = typeof input.slug === 'string' ? input.slug.trim() : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n/g, '\n') : '';
  const cover = typeof input.cover === 'string' ? input.cover.trim() : '';
  if (!slugPattern.test(slug) || slug.length > 160) throw new AdminPostError('invalid_slug');
  if (!title || title.length > 160) throw new AdminPostError('invalid_title');
  if (!description || description.length > 500) throw new AdminPostError('invalid_description');
  if (body.length > 1_500_000) throw new AdminPostError('body_too_large', 413);
  if (cover && !/^\.\.\/\.\.\/assets\/posts\/[a-zA-Z0-9_./-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(cover)) {
    throw new AdminPostError('invalid_cover');
  }
  return {
    slug,
    title,
    description,
    date: normalizeDate(input.date),
    tags: parseTags(input.tags),
    draft: input.draft === true,
    copyright: input.copyright !== false,
    ...(cover ? { cover } : {}),
    body,
  };
}

function parseDocument(source: string, slug: string, extension: '.md' | '.mdx', updatedAt: string): AdminPost {
  const match = source.match(frontmatterPattern);
  if (!match) throw new AdminPostError('invalid_frontmatter', 422);
  const raw = load(match[1]);
  if (!raw || typeof raw !== 'object') throw new AdminPostError('invalid_frontmatter', 422);
  const data = raw as Record<string, unknown>;
  return {
    ...validateInput({
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      tags: data.tags,
      draft: data.draft === true,
      copyright: data.copyright !== false,
      cover: data.cover,
      body: source.slice(match[0].length),
    }),
    extension,
    updatedAt,
  };
}

function serializeDocument(post: AdminPostInput) {
  const frontmatter = dump({
    title: post.title,
    description: post.description,
    date: post.date,
    tags: post.tags,
    draft: post.draft,
    copyright: post.copyright,
    ...(post.cover ? { cover: post.cover } : {}),
  }, { lineWidth: -1, noRefs: true, quotingType: "'", forceQuotes: true });
  return `---\n${frontmatter}---\n\n${post.body.replace(/^\n+/, '')}`;
}

async function files(directory = postsDirectory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return supportedExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

async function locate(slug: string) {
  if (!slugPattern.test(slug)) throw new AdminPostError('invalid_slug');
  for (const extension of supportedExtensions) {
    const path = containedPath(`${slug}${extension}`);
    try {
      if ((await stat(path)).isFile()) return { path, extension: extension as '.md' | '.mdx' };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return null;
}

export async function listAdminPosts() {
  await mkdir(postsDirectory, { recursive: true });
  const posts = await Promise.all((await files()).map(async path => {
    const extension = extname(path) as '.md' | '.mdx';
    const slug = path.slice(postsDirectory.length + 1, -extension.length).split(sep).join('/');
    const info = await stat(path);
    return parseDocument(await readFile(path, 'utf8'), slug, extension, info.mtime.toISOString());
  }));
  return posts
    .map(({ body: _body, ...post }) => post)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-Hant'));
}

export async function getAdminPost(slug: string) {
  const located = await locate(slug);
  if (!located) throw new AdminPostError('not_found', 404);
  const info = await stat(located.path);
  return parseDocument(await readFile(located.path, 'utf8'), slug, located.extension, info.mtime.toISOString());
}

async function atomicWrite(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, path);
}

function immutableFileSystem(error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === 'EROFS' || code === 'EPERM' || code === 'EACCES';
}

async function persistPost(path: string, contents: string, repositoryPath: string, message: string) {
  let synced = false;
  try {
    synced = await syncContentFile(repositoryPath, contents, message);
  } catch (error) {
    if (error instanceof ContentSyncError) throw new AdminPostError(error.code, 502);
    throw error;
  }
  try {
    await atomicWrite(path, contents);
  } catch (error) {
    if (!synced || !immutableFileSystem(error)) throw error;
  }
  return synced;
}

export async function createAdminPost(value: unknown) {
  const post = validateInput(value);
  if (await locate(post.slug)) throw new AdminPostError('already_exists', 409);
  const contents = serializeDocument(post);
  const synced = await persistPost(
    containedPath(`${post.slug}.md`),
    contents,
    `src/content/posts/${post.slug}.md`,
    `Create article: ${post.title}`,
  );
  if (synced) return { ...post, extension: '.md' as const, updatedAt: new Date().toISOString() };
  return getAdminPost(post.slug);
}

export async function updateAdminPost(slug: string, value: unknown) {
  const post = validateInput(value);
  if (post.slug !== slug) throw new AdminPostError('slug_immutable', 409);
  const located = await locate(slug);
  if (!located) throw new AdminPostError('not_found', 404);
  const contents = serializeDocument(post);
  const synced = await persistPost(
    located.path,
    contents,
    `src/content/posts/${post.slug}${located.extension}`,
    `Update article: ${post.title}`,
  );
  if (synced) return { ...post, extension: located.extension, updatedAt: new Date().toISOString() };
  return getAdminPost(slug);
}
