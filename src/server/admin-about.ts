import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ContentSyncError, syncContentFile } from './content-sync';
import { requestAIText } from './mascot-provider';

const aboutFile = resolve(process.env.CONTENT_ABOUT_FILE || 'src/content/about.json');
let runtimeContent: AboutContent | undefined;

export class AdminAboutError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

type RecordValue = Record<string, unknown>;
export type AboutContent = typeof import('../content/about.json').default;

export function sortExperienceItems(items: AboutContent['experience']['items']) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => right.item.time.localeCompare(left.item.time) || left.index - right.index)
    .map(({ item }) => item);
}

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
      if (sectionName === 'experience') {
        if (row.time === undefined) row.time = '';
        if (row.link === undefined) row.link = '';
        if (typeof row.time !== 'string' || (row.time && !/^\d{4}-\d{2}-\d{2}$/.test(row.time))) {
          throw new AdminAboutError(`invalid_experience_items_${index}_time`);
        }
        if (typeof row.link !== 'string') throw new AdminAboutError(`invalid_experience_items_${index}_link`);
        if (row.link) validateUrl(row.link, `experience_items_${index}_link`);
      }
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
  if (runtimeContent) return structuredClone(runtimeContent);
  try {
    return validateAboutContent(JSON.parse(await readFile(aboutFile, 'utf8')));
  } catch (error) {
    if (error instanceof AdminAboutError) throw error;
    if (error instanceof SyntaxError) throw new AdminAboutError('invalid_json', 422);
    throw error;
  }
}

async function translateIdentity(content: AboutContent) {
  let current: AboutContent | undefined;
  try { current = await getAboutContent(); } catch {}
  const subtitle = content.identity.subtitle['zh-TW'];
  const intro = content.identity.intro['zh-TW'];
  if (current?.identity.subtitle['zh-TW'] === subtitle && current.identity.intro['zh-TW'] === intro) return content;

  try {
    const result = await requestAIText({
      model: process.env.AI_TRANSLATION_MODEL || undefined,
      reasoningEffort: 'low',
      maxOutputTokens: 1_200,
      timeoutMs: 90_000,
      instructions: [
        'Translate two Traditional Chinese profile fields into natural English, Japanese, and Korean.',
        'Return only valid JSON with exactly these keys: enSubtitle, enIntro, jaSubtitle, jaIntro, koSubtitle, koIntro.',
        'Preserve the concise personal-blog voice. Do not add facts, Markdown fences, or explanations.',
      ].join(' '),
      input: JSON.stringify({ subtitle, intro }),
    });
    const translated = JSON.parse(result.text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown>;
    for (const key of ['enSubtitle', 'enIntro', 'jaSubtitle', 'jaIntro', 'koSubtitle', 'koIntro']) {
      if (typeof translated[key] !== 'string' || !translated[key].trim()) throw new Error(`Missing ${key}`);
    }
    content.identity.subtitle.en = String(translated.enSubtitle);
    content.identity.intro.en = String(translated.enIntro);
    content.identity.subtitle.ja = String(translated.jaSubtitle);
    content.identity.intro.ja = String(translated.jaIntro);
    content.identity.subtitle.ko = String(translated.koSubtitle);
    content.identity.intro.ko = String(translated.koIntro);
    return validateAboutContent(content);
  } catch (error) {
    console.error('About translation failed', error instanceof Error ? error.message : error);
    throw new AdminAboutError('translation_failed', 502);
  }
}

export async function updateAboutContent(value: unknown) {
  const content = await translateIdentity(validateAboutContent(value));
  content.experience.items = sortExperienceItems(content.experience.items);
  const contents = `${JSON.stringify(content, null, 2)}\n`;
  let synced = false;
  try {
    synced = await syncContentFile('src/content/about.json', contents, 'Update About page');
  } catch (error) {
    if (error instanceof ContentSyncError) throw new AdminAboutError(error.code, 502);
    throw error;
  }
  const directory = dirname(aboutFile);
  try {
    await mkdir(directory, { recursive: true });
    const temporary = `${aboutFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, aboutFile);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (!synced || !['EROFS', 'EPERM', 'EACCES'].includes(code || '')) throw error;
  }
  runtimeContent = structuredClone(content);
  return structuredClone(content);
}
