import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { loadAIProvider, requestAIText } from '../src/server/mascot-provider.ts';

const root = process.cwd();
const targets = ['en', 'ja', 'ko'];
const targetNames = { en: 'English', ja: 'Japanese', ko: 'Korean' };
const manifestPath = join(root, 'src/generated/i18n/manifest.json');
const configuredModel = process.env.AI_TRANSLATION_MODEL || process.env.OPENAI_TRANSLATION_MODEL;

async function readJson(path, fallback = {}) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function exists(path) {
  try { await readFile(path); return true; } catch { return false; }
}

function promptFor(kind, locale, source) {
  const format = kind === 'messages'
    ? 'Return a JSON object with exactly the same keys. Translate values only.'
    : kind === 'about'
      ? 'Return the complete valid JSON object with exactly the same structure. Translate human-readable prose, labels, roles, captions, and quotes only. Preserve names, URLs, email addresses, dates, handles, technology names, and object keys.'
    : 'Return the complete Markdown file. Preserve YAML keys, dates, tags, URLs, code fences, inline code, HTML, and file paths. Translate title, description, headings, and prose only.';
  return `Translate this Traditional Chinese ${kind} source into ${targetNames[locale]}.\n${format}\nKeep the author voice concise and natural. Do not add commentary.\n\n${source}`;
}

async function translate(provider, kind, locale, source) {
  const messageSchema = kind === 'messages' ? {
    type: 'json_schema',
    name: 'translated_messages',
    strict: true,
    schema: {
      type: 'object',
      properties: Object.fromEntries(Object.keys(JSON.parse(source)).map(key => [key, { type: 'string' }])),
      required: Object.keys(JSON.parse(source)),
      additionalProperties: false,
    },
  } : undefined;
  const request = textFormat => requestAIText({
      provider,
      model: configuredModel || provider.model,
      reasoningEffort: 'low',
      maxOutputTokens: Math.min(128_000, Math.max(4_000, source.length * 2)),
      timeoutMs: 180_000,
      instructions: promptFor(kind, locale, ''),
      input: source,
      textFormat,
    });
  let response;
  try {
    response = await request(messageSchema);
  } catch (error) {
    if (!messageSchema) throw error;
    response = await request(undefined);
  }
  const text = response.text.trim().replace(/^```(?:json|markdown)?\s*/i, '').replace(/\s*```$/, '');
  if (kind === 'messages' || kind === 'about') JSON.parse(text);
  if (!text) throw new Error('Translation returned an empty response.');
  return `${text}\n`;
}

async function main() {
  const manifest = await readJson(manifestPath);
  const bootstrapCache = Object.keys(manifest).length === 0;
  const sources = [
    { kind: 'messages', path: join(root, 'src/i18n/zh-TW.json'), base: join(root, 'src/i18n') },
    { kind: 'about', path: join(root, 'src/content/about.json'), base: join(root, 'src/content') },
    ...(await walk(join(root, 'src/content/posts')))
      .filter(path => ['.md', '.mdx'].includes(extname(path)) && !relative(join(root, 'src/content/posts'), path).startsWith(`admin-preview${process.platform === 'win32' ? '\\' : '/'}`))
      .map(path => ({ kind: 'posts', path, base: join(root, 'src/content/posts') })),
    ...(await walk(join(root, 'src/content/projects'))).filter(path => ['.md', '.mdx'].includes(extname(path))).map(path => ({ kind: 'projects', path, base: join(root, 'src/content/projects') })),
  ];

  let provider;
  let providerError;
  const getProvider = async () => {
    if (provider) return provider;
    if (providerError) throw providerError;
    try {
      provider = await loadAIProvider();
      return provider;
    } catch (error) {
      providerError = error;
      throw error;
    }
  };
  let changed = false;
  for (const item of sources) {
    const source = await readFile(item.path, 'utf8');
    const sourceHash = hash(source);
    const relativePath = item.kind === 'messages' ? 'messages.json' : relative(item.base, item.path);

    for (const locale of targets) {
      const output = item.kind === 'messages'
        ? join(root, `src/generated/i18n/messages/${locale}.json`)
        : item.kind === 'about'
          ? join(root, `src/generated/i18n/about/${locale}.json`)
        : join(root, `src/generated/i18n/${item.kind}/${locale}/${relativePath}`);
      const key = `${item.kind}:${relativePath}:${locale}`;
      if (manifest[key] === sourceHash && await exists(output)) continue;

      let activeProvider;
      try {
        activeProvider = await getProvider();
      } catch {
        if (await exists(output)) {
          if (bootstrapCache) {
            manifest[key] = sourceHash;
            changed = true;
            console.log(`[i18n] Accepted bundled cache ${key}`);
            continue;
          }
          console.warn(`[i18n] ${key} changed; using cached translation because the AI provider is unavailable.`);
          continue;
        }
        if (item.kind === 'about') {
          await mkdir(dirname(output), { recursive: true });
          await writeFile(output, `${source.trim()}\n`);
          console.warn(`[i18n] ${key} is using the source-language fallback because the AI provider is unavailable.`);
          continue;
        }
        throw new Error(`[i18n] Missing translation ${key} and the AI provider is unavailable.`);
      }

      try {
        const translated = await translate(activeProvider, item.kind, locale, source);
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, translated);
        manifest[key] = sourceHash;
        changed = true;
        console.log(`[i18n] Updated ${key}`);
      } catch (error) {
        if (await exists(output)) {
          console.warn(`[i18n] ${key} failed; keeping cached translation.`, error.message);
          continue;
        }
        throw error;
      }
    }
  }

  if (changed || !(await exists(manifestPath))) {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
