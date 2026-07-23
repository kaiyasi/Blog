import type { APIRoute } from 'astro';
import { generateMascotLine, type MascotContext } from '../../../server/mascot-provider';
import eventConfig from '../../../config/mascot-events.json';

export const prerender = false;

const limits = new Map<string, { count: number; resetAt: number }>();
const allowedCharacters = new Set(['mafuyu', 'ritsuka']);
const allowedScenes = new Set(['campus', 'stage', 'weekend']);
const allowedLocales = new Set(['zh-TW', 'en', 'ja', 'ko']);
const allowedTriggers = new Set([
  'arrival', 'click', 'rapid-click', 'return', 'holiday', 'idle', 'article-progress',
  'article-preview', 'navigation', 'nav-interaction', 'copy-code', 'copy-text', 'search', 'language', 'theme',
]);
const allowedZones = new Set(['top', 'middle', 'end']);
const allowedReferenceModes = new Set(['site', 'given']);
const allowedHolidays = new Set(eventConfig.holidays.map(item => item.id));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const clientAddress = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || request.headers.get('x-real-ip')
  || 'local';

const rateLimited = (request: Request) => {
  const key = clientAddress(request);
  const now = Date.now();
  const current = limits.get(key);
  if (!current || now >= current.resetAt) {
    limits.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 12;
};

const shortString = (value: unknown, max: number) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const validHoliday = (value: unknown) => {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const holiday = value as Record<string, unknown>;
  return shortString(holiday.id, 40)
    && allowedHolidays.has(String(holiday.id))
    && shortString(holiday.label, 60);
};

const validArticle = (value: unknown) => {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const article = value as Record<string, unknown>;
  return shortString(article.title, 180)
    && shortString(article.description, 500)
    && Array.isArray(article.tags)
    && article.tags.length <= 12
    && article.tags.every(tag => shortString(tag, 40))
    && (article.heading === undefined || shortString(article.heading, 180))
    && typeof article.progress === 'number'
    && article.progress >= 0
    && article.progress <= 1;
};

const validContext = (value: unknown): value is MascotContext => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return allowedCharacters.has(String(input.character))
    && allowedScenes.has(String(input.scene))
    && allowedLocales.has(String(input.locale))
    && allowedTriggers.has(String(input.trigger))
    && allowedZones.has(String(input.zone))
    && typeof input.pathname === 'string'
    && input.pathname.startsWith('/')
    && input.pathname.length <= 180
    && ((input.hour === undefined && input.timeZone === undefined)
      || (Number.isInteger(input.hour)
        && Number(input.hour) >= 0
        && Number(input.hour) <= 23
        && typeof input.timeZone === 'string'
        && input.timeZone.length <= 80))
    && Number.isInteger(input.interactionCount)
    && Number(input.interactionCount) >= 0
    && Number(input.interactionCount) <= 10_000
    && allowedReferenceModes.has(String(input.referenceMode))
    && (input.target === undefined || shortString(input.target, 120))
    && validHoliday(input.holiday)
    && validArticle(input.article);
};

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'invalid_content_type' }, 415);
  if (rateLimited(request)) return json({ error: 'rate_limited' }, 429);

  try {
    const body = await request.json();
    if (!validContext(body)) return json({ error: 'invalid_request' }, 400);
    const result = await generateMascotLine(body);
    return json({ line: result.line });
  } catch (error) {
    console.error('[mascot-chat]', error instanceof Error ? error.message : 'Unknown provider error');
    return json({ error: 'voice_unavailable' }, 503);
  }
};
