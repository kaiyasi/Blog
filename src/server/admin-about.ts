import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const aboutFile = resolve(process.env.CONTENT_ABOUT_FILE || 'src/content/about.json');

export class AdminAboutError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

type RecordValue = Record<string, unknown>;
export type AboutContent = typeof import('../content/about.json').default;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, field: string, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new AdminAboutError(`invalid_${field}`);
  }
}

function requireObject(value: unknown, field: string): RecordValue {
  if (!isRecord(value)) throw new AdminAboutError(`invalid_${field}`);
  return value;
}

function requireArray(value: unknown, field: string, max = 50) {
  if (!Array.isArray(value) || value.length > max) throw new AdminAboutError(`invalid_${field}`);
  return value;
}

function validateQuote(value: unknown, field: string) {
  const quote = requireObject(value, field);
  requireString(quote.text, `${field}_text`);
  requireString(quote.source, `${field}_source`, 200);
}

function validateUrl(value: unknown, field: string, allowMail = false) {
  requireString(value, field, 2000);
  try {
    const url = new URL(value as string);
    if (!['http:', 'https:', ...(allowMail ? ['mailto:'] : [])].includes(url.protocol)) throw new Error();
  } catch {
    throw new AdminAboutError(`invalid_${field}`);
  }
}

export function validateAboutContent(value: unknown): AboutContent {
  const root = requireObject(value, 'content');
  const identity = requireObject(root.identity, 'identity');
  for (const field of ['name', 'alias', 'avatar', 'avatarAlt', 'portraitCaption'] as const) requireString(identity[field], `identity_${field}`, 500);
  if (!(identity.avatar as string).startsWith('/')) throw new AdminAboutError('invalid_identity_avatar');
  for (const localizedField of ['subtitle', 'intro'] as const) {
    const localized = requireObject(identity[localizedField], `identity_${localizedField}`);
    for (const locale of ['zh-TW', 'en', 'ja', 'ko']) requireString(localized[locale], `identity_${localizedField}_${locale}`);
  }
  validateQuote(identity.quote, 'identity_quote');
  requireArray(identity.socialLinks, 'identity_socialLinks').forEach((item, index) => {
    const link = requireObject(item, `identity_socialLinks_${index}`);
    requireString(link.label, `identity_socialLinks_${index}_label`, 100);
    validateUrl(link.url, `identity_socialLinks_${index}_url`);
  });
  requireArray(identity.metadata, 'identity_metadata').forEach((item, index) => {
    const metadata = requireObject(item, `identity_metadata_${index}`);
    requireString(metadata.label, `identity_metadata_${index}_label`, 100);
    requireString(metadata.value, `identity_metadata_${index}_value`, 200);
  });

  const about = requireObject(root.about, 'about');
  requireString(about.opening, 'about_opening');
  requireString(about.statement, 'about_statement');
  requireArray(about.items, 'about_items').forEach((item, index) => requireString(item, `about_items_${index}`));
  validateQuote(about.quote, 'about_quote');

  requireArray(root.skillGroups, 'skillGroups').forEach((item, index) => {
    const group = requireObject(item, `skillGroups_${index}`);
    requireString(group.title, `skillGroups_${index}_title`, 200);
    requireArray(group.items, `skillGroups_${index}_items`).forEach((skill, skillIndex) => requireString(skill, `skillGroups_${index}_items_${skillIndex}`, 200));
  });

  for (const sectionName of ['roadmap', 'projects', 'experience'] as const) {
    const section = requireObject(root[sectionName], sectionName);
    requireArray(section.items, `${sectionName}_items`).forEach((item, index) => {
      const row = requireObject(item, `${sectionName}_items_${index}`);
      requireString(row.title, `${sectionName}_items_${index}_title`, 500);
      requireString(row[sectionName === 'experience' ? 'role' : 'body'], `${sectionName}_items_${index}_body`);
      if (sectionName === 'projects') validateUrl(row.url, `${sectionName}_items_${index}_url`);
    });
    validateQuote(section.quote, `${sectionName}_quote`);
  }

  const connect = requireObject(root.connect, 'connect');
  requireArray(connect.items, 'connect_items').forEach((item, index) => {
    const link = requireObject(item, `connect_items_${index}`);
    requireString(link.label, `connect_items_${index}_label`, 100);
    requireString(link.value, `connect_items_${index}_value`, 500);
    validateUrl(link.url, `connect_items_${index}_url`, true);
  });
  validateQuote(connect.quote, 'connect_quote');
  return value as AboutContent;
}

export async function getAboutContent() {
  try {
    return validateAboutContent(JSON.parse(await readFile(aboutFile, 'utf8')));
  } catch (error) {
    if (error instanceof AdminAboutError) throw error;
    if (error instanceof SyntaxError) throw new AdminAboutError('invalid_json', 422);
    throw error;
  }
}

export async function updateAboutContent(value: unknown) {
  const content = validateAboutContent(value);
  const directory = dirname(aboutFile);
  await mkdir(directory, { recursive: true });
  const temporary = `${aboutFile}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, aboutFile);
  return content;
}
