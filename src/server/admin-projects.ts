import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { dump, load } from 'js-yaml';
import { ContentSyncError, syncContentFile } from './content-sync';

const projectsDirectory = resolve(process.env.CONTENT_PROJECTS_DIRECTORY || process.cwd(), process.env.CONTENT_PROJECTS_DIRECTORY ? '' : 'src/content/projects');
const slugPattern = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/;
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const supportedExtensions = new Set(['.md', '.mdx']);

export interface AdminProjectInput {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  url?: string;
  github?: string;
  featured: boolean;
  body: string;
}

export interface AdminProject extends AdminProjectInput {
  extension: '.md' | '.mdx';
  updatedAt: string;
}

export class AdminProjectError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

function containedPath(path: string) {
  const absolute = resolve(projectsDirectory, path);
  if (absolute !== projectsDirectory && !absolute.startsWith(`${projectsDirectory}${sep}`)) throw new AdminProjectError('invalid_slug');
  return absolute;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value) return value;
  }
  throw new AdminProjectError('invalid_date');
}

function validateUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 2_000) throw new AdminProjectError(`invalid_${field}`);
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new AdminProjectError(`invalid_${field}`);
  }
}

function validateInput(value: unknown): AdminProjectInput {
  if (!value || typeof value !== 'object') throw new AdminProjectError('invalid_input');
  const input = value as Record<string, unknown>;
  const slug = typeof input.slug === 'string' ? input.slug.trim() : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const body = typeof input.body === 'string' ? input.body.replace(/\r\n/g, '\n') : '';
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(tag => typeof tag === 'string' ? tag.trim() : '').filter(Boolean))] : [];
  if (!slugPattern.test(slug) || slug.length > 160) throw new AdminProjectError('invalid_slug');
  if (!title || title.length > 160) throw new AdminProjectError('invalid_title');
  if (!description || description.length > 500) throw new AdminProjectError('invalid_description');
  if (body.length > 1_500_000) throw new AdminProjectError('body_too_large', 413);
  if (tags.length > 20 || tags.some(tag => tag.length > 40)) throw new AdminProjectError('invalid_tags');
  const url = validateUrl(input.url, 'url');
  const github = validateUrl(input.github, 'github');
  return { slug, title, description, date: normalizeDate(input.date), tags, ...(url ? { url } : {}), ...(github ? { github } : {}), featured: input.featured === true, body };
}

function parseDocument(source: string, slug: string, extension: '.md' | '.mdx', updatedAt: string): AdminProject {
  const match = source.match(frontmatterPattern);
  if (!match) throw new AdminProjectError('invalid_frontmatter', 422);
  const raw = load(match[1]);
  if (!raw || typeof raw !== 'object') throw new AdminProjectError('invalid_frontmatter', 422);
  const data = raw as Record<string, unknown>;
  return { ...validateInput({ slug, title: data.title, description: data.description, date: data.date, tags: data.tags, url: data.url, github: data.github, featured: data.featured, body: source.slice(match[0].length) }), extension, updatedAt };
}

function serializeDocument(project: AdminProjectInput) {
  const frontmatter = dump({ title: project.title, description: project.description, date: project.date, tags: project.tags, ...(project.url ? { url: project.url } : {}), ...(project.github ? { github: project.github } : {}), featured: project.featured }, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: true });
  return `---\n${frontmatter}---\n\n${project.body.replace(/^\n+/, '')}`;
}

async function files(directory = projectsDirectory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return supportedExtensions.has(extname(entry.name)) ? [path] : [];
  }))).flat();
}

async function locate(slug: string) {
  if (!slugPattern.test(slug)) throw new AdminProjectError('invalid_slug');
  for (const extension of supportedExtensions) {
    const path = containedPath(`${slug}${extension}`);
    try { if ((await stat(path)).isFile()) return { path, extension: extension as '.md' | '.mdx' }; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return null;
}

export async function listAdminProjects() {
  await mkdir(projectsDirectory, { recursive: true });
  const projects = await Promise.all((await files()).map(async path => {
    const extension = extname(path) as '.md' | '.mdx';
    const slug = path.slice(projectsDirectory.length + 1, -extension.length).split(sep).join('/');
    return parseDocument(await readFile(path, 'utf8'), slug, extension, (await stat(path)).mtime.toISOString());
  }));
  return projects.map(({ body: _body, ...project }) => project).sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-Hant'));
}

export async function getAdminProject(slug: string) {
  const found = await locate(slug);
  if (!found) throw new AdminProjectError('not_found', 404);
  return parseDocument(await readFile(found.path, 'utf8'), slug, found.extension, (await stat(found.path)).mtime.toISOString());
}

async function persist(path: string, contents: string, repositoryPath: string, message: string) {
  let synced = false;
  try { synced = await syncContentFile(repositoryPath, contents, message); } catch (error) { if (error instanceof ContentSyncError) throw new AdminProjectError(error.code, 502); throw error; }
  try {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!synced || !['EROFS', 'EPERM', 'EACCES'].includes(code || '')) throw error;
  }
  return synced;
}

export async function createAdminProject(value: unknown) {
  const project = validateInput(value);
  if (await locate(project.slug)) throw new AdminProjectError('already_exists', 409);
  const synced = await persist(containedPath(`${project.slug}.md`), serializeDocument(project), `src/content/projects/${project.slug}.md`, `Create project: ${project.title}`);
  return synced ? { ...project, extension: '.md' as const, updatedAt: new Date().toISOString() } : getAdminProject(project.slug);
}

export async function updateAdminProject(slug: string, value: unknown) {
  const project = validateInput(value);
  if (project.slug !== slug) throw new AdminProjectError('slug_immutable', 409);
  const found = await locate(slug);
  if (!found) throw new AdminProjectError('not_found', 404);
  const synced = await persist(found.path, serializeDocument(project), `src/content/projects/${project.slug}${found.extension}`, `Update project: ${project.title}`);
  return synced ? { ...project, extension: found.extension, updatedAt: new Date().toISOString() } : getAdminProject(slug);
}
