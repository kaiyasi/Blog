import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const root = process.cwd();
const oldSite = 'https://blog.gonets.top';
const posts = [
  { old: 'The-New-Road-With-AI', file: 'the-new-road-with-ai.md' },
  { old: 'SCIST-Camp', file: 'scist-camp.md' },
  { old: 'FhCTF-WriteUP', file: 'fhctf-writeup.md' },
  { old: 'Taiwan-Korea-Open-Data-Project', file: 'taiwan-korea-open-data-project.md' },
  { old: 'NTNU-CSIE-Visit', file: 'ntnu-csie-visit.md' },
];
const locales = [
  { local: 'zh-TW', old: 'tw', base: 'src/content/posts', assetPrefix: '../../assets/posts' },
  { local: 'en', old: 'en', base: 'src/generated/i18n/posts/en', assetPrefix: '../../../../assets/posts' },
  { local: 'ja', old: 'jp', base: 'src/generated/i18n/posts/ja', assetPrefix: '../../../../assets/posts' },
  { local: 'ko', old: 'ko', base: 'src/generated/i18n/posts/ko', assetPrefix: '../../../../assets/posts' },
];
const typeExtensions = {
  'image/avif': '.avif', 'image/gif': '.gif', 'image/jpeg': '.jpg',
  'image/png': '.png', 'image/svg+xml': '.svg', 'image/webp': '.webp',
};

function frontmatterOf(source) {
  const match = source.match(/^---\n[\s\S]*?\n---/);
  if (!match) throw new Error('Missing frontmatter');
  return match[0];
}

function withCover(frontmatter, cover) {
  if (/\ncover:/.test(frontmatter)) return frontmatter.replace(/\ncover:.*(?=\n)/, `\ncover: '${cover}'`);
  return frontmatter.replace(/\n---$/, `\ncover: '${cover}'\n---`);
}

function legacyCallouts(html) {
  return html.replace(/<div class="custom-quote\s+([^"]+)">([\s\S]*?)<\/div>/g, (_, type, body) => {
    const title = body.match(/<p class="custom-quote-title">([\s\S]*?)<\/p>/)?.[1] || type;
    const content = body
      .replace(/<span class="custom-quote-svg">[\s\S]*?<\/span>/, '')
      .replace(/<p class="custom-quote-title">[\s\S]*?<\/p>/, '');
    return `<aside data-callout="${type}" data-title="${title}">${content}</aside>`;
  });
}

function toMarkdown(html) {
  const turndown = new TurndownService({
    bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*',
    headingStyle: 'atx', strongDelimiter: '**',
  });
  turndown.use(gfm);
  turndown.remove(['button', 'svg']);
  turndown.addRule('headerLinks', {
    filter: (node) => node.nodeName === 'A' && node.classList.contains('headerlink'),
    replacement: () => '',
  });
  turndown.addRule('legacyCodeBlock', {
    filter: (node) => node.nodeName === 'DIV' && String(node.className).split(/\s+/).some((name) => name.startsWith('language-')) && node.querySelector('pre code'),
    replacement: (_content, node) => {
      const language = String(node.className).split(/\s+/).find((name) => name.startsWith('language-'))?.slice(9) || '';
      const code = node.querySelector('pre code').textContent.replace(/\n$/, '');
      const ticks = Math.max(3, ...[...code.matchAll(/`+/g)].map((match) => match[0].length + 1));
      const fence = '`'.repeat(ticks);
      return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
    },
  });
  turndown.addRule('legacyCallout', {
    filter: (node) => node.nodeName === 'ASIDE' && node.hasAttribute('data-callout'),
    replacement: (content, node) => {
      const type = node.getAttribute('data-callout') || 'note';
      const title = node.getAttribute('data-title') || type;
      return `\n\n:::${type}[${title}]\n${content.trim()}\n:::\n\n`;
    },
  });

  const cleaned = legacyCallouts(html)
    .replace(/<span class="lang">[\s\S]*?<\/span>/g, '')
    .replace(/<center>/g, '<p>')
    .replace(/<\/center>/g, '</p>');
  return turndown.turndown(cleaned)
    .replace(/^(#{1,5}) /gm, '#$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchRequired(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Kaiyasi content migration' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

async function localizeImage(url, slug, kind = 'image') {
  const response = await fetchRequired(url);
  const contentType = response.headers.get('content-type')?.split(';')[0];
  const urlExtension = extname(new URL(url).pathname).toLowerCase();
  const extension = typeExtensions[contentType] || (/^\.[a-z0-9]{2,5}$/.test(urlExtension) ? urlExtension : '.jpg');
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 12);
  const filename = `${kind}-${hash}${extension}`;
  const directory = join(root, 'src/assets/posts', slug);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), Buffer.from(await response.arrayBuffer()));
  return filename;
}

async function migratePost(post) {
  const slug = post.file.replace(/\.md$/, '');
  const sourcePath = join(root, 'src/content/posts', post.file);
  const sourceFrontmatter = frontmatterOf(await readFile(sourcePath, 'utf8'));
  const sourceApi = await (await fetchRequired(`${oldSite}/api/articles/${post.old}/tw.json`)).json();
  const coverFile = await localizeImage(sourceApi.cover, slug, 'cover');
  const imageUrls = [...new Set([...sourceApi.content.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]))];
  const imageFiles = new Map();

  for (const url of imageUrls) {
    try {
      imageFiles.set(url, await localizeImage(url, slug));
    } catch (error) {
      console.warn(`[image] Keeping remote URL: ${error.message}`);
    }
  }

  for (const locale of locales) {
    const targetPath = join(root, locale.base, post.file);
    const existing = await readFile(targetPath, 'utf8');
    const api = locale.old === 'tw'
      ? sourceApi
      : await (await fetchRequired(`${oldSite}/api/articles/${post.old}/${locale.old}.json`)).json();
    let html = api.content;
    // The legacy JA/KO AI endpoints accidentally append the next FhCTF article.
    if (post.old === 'The-New-Road-With-AI') html = html.split('<h1 id="FhCTF-Writeup">')[0];
    for (const [url, filename] of imageFiles) {
      html = html.split(url).join(`${locale.assetPrefix}/${slug}/${filename}`);
    }
    const cover = `${locale.assetPrefix}/${slug}/${coverFile}`;
    const frontmatter = withCover(locale.old === 'tw' ? sourceFrontmatter : frontmatterOf(existing), cover);
    await writeFile(targetPath, `${frontmatter}\n\n${toMarkdown(html)}\n`);
    console.log(`[content] ${locale.local}/${post.file}`);
  }
}

for (const post of posts) await migratePost(post);

const manifestPath = join(root, 'src/generated/i18n/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const post of posts) {
  const source = await readFile(join(root, 'src/content/posts', post.file), 'utf8');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  for (const locale of ['en', 'ja', 'ko']) manifest[`posts:${post.file}:${locale}`] = sourceHash;
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
