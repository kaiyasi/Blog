import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getAboutContent, validateAboutContent, type AboutContent } from '../../server/admin-about';

export const prerender = false;

const locales = ['zh-TW', 'en', 'ja', 'ko'] as const;
type Locale = (typeof locales)[number];
const allowedOrigins = new Set([
  'https://gonets.top',
  'https://www.gonets.top',
  'http://192.168.31.66:12021',
  'http://127.0.0.1:12021',
]);

function corsOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return undefined;
  if (allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return undefined;
}

function responseHeaders(request: Request, etag?: string) {
  const result = new Headers({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  });
  const origin = corsOrigin(request);
  if (origin) result.set('Access-Control-Allow-Origin', origin);
  if (etag) result.set('ETag', etag);
  return result;
}

async function translatedAbout(locale: Locale, source: AboutContent) {
  if (locale === 'zh-TW') return source;
  try {
    return validateAboutContent(JSON.parse(await readFile(resolve(`src/generated/i18n/about/${locale}.json`), 'utf8')));
  } catch {
    return source;
  }
}

function profileFrom(content: AboutContent, locale: Locale) {
  return {
    name: content.identity.name,
    alias: content.identity.alias,
    role: content.about.opening,
    intro: content.identity.intro[locale] || content.identity.intro['zh-TW'],
    location: 'Taipei, Taiwan',
    skills: content.skillGroups.flatMap(group => group.items).slice(0, 12),
    journey: content.experience.items.slice(-6).reverse().map(item => ({ title: item.title, detail: item.role })),
    contact: content.connect.items.map(item => ({ label: item.label, value: item.value, url: item.url })),
  };
}

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = corsOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  const headers = responseHeaders(request);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
};

export const GET: APIRoute = async ({ request }) => {
  const source = await getAboutContent();
  const aboutByLocale = Object.fromEntries(
    await Promise.all(locales.map(async locale => [locale, await translatedAbout(locale, source)])),
  ) as Record<Locale, AboutContent>;
  const sourceProjects = (await getCollection('projects')).sort(
    (a, b) => Number(b.data.featured) - Number(a.data.featured) || b.data.date.valueOf() - a.data.date.valueOf(),
  );
  const translations = await getCollection('projectTranslations');
  const profile = Object.fromEntries(locales.map(locale => [locale, profileFrom(aboutByLocale[locale], locale)]));
  const projects = Object.fromEntries(locales.map(locale => {
    const collectionProjects = sourceProjects.map(project => {
      const translated = locale === 'zh-TW' ? project : translations.find(item => item.id === `${locale}/${project.id}`);
      return {
        title: translated?.data.title || project.data.title,
        description: translated?.data.description || project.data.description,
        tags: project.data.tags,
        url: project.data.url,
        github: project.data.github,
      };
    });
    const knownTitles = new Set(collectionProjects.map(project => project.title.toLocaleLowerCase()));
    const additionalProjects = aboutByLocale[locale].projects.items
      .filter(project => !knownTitles.has(project.title.toLocaleLowerCase()))
      .map(project => ({ title: project.title, description: project.body, tags: [], github: project.url }));
    return [locale, [...collectionProjects, ...additionalProjects]];
  }));
  let modified = new Date();
  try { modified = (await stat(resolve(process.env.CONTENT_ABOUT_FILE || 'src/content/about.json'))).mtime; } catch {}
  const payload = { version: 1, generatedAt: modified.toISOString(), locales, profile, projects };
  const body = JSON.stringify(payload);
  const etag = `\"${createHash('sha256').update(body).digest('base64url')}\"`;
  const headers = responseHeaders(request, etag);
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers });
};
