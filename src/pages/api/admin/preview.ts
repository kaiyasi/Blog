import type { APIRoute } from 'astro';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { communityJson, sameOrigin } from '../../../server/community-http';
import { remarkCallouts } from '../../../markdown/remark-callouts.mjs';
import { remarkEmbeds } from '../../../markdown/remark-embeds.mjs';

export const prerender = false;

const processor = createMarkdownProcessor({
  remarkPlugins: [remarkDirective, remarkEmbeds, remarkCallouts],
  shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
});

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function previewDocument(payload: Record<string, unknown>, body: string) {
  const dark = payload.theme === 'dark';
  const palette = dark ? {
    bg: '#191c1d', surface: '#242829', border: '#454d4f', text: '#eceeeb',
    muted: '#adb5b6', faint: '#778184', code: '#111415', accent: '#d66a61', blue: '#62a2b5',
  } : {
    bg: '#d8d8d1', surface: '#e6e5df', border: '#aaa9a2', text: '#25292a',
    muted: '#5d6466', faint: '#7c8385', code: '#c9cac5', accent: '#c85e56', blue: '#4d8fa3',
  };
  const title = escapeHtml(payload.title || '未命名文章');
  const description = escapeHtml(payload.description || '尚未填寫摘要');
  const date = escapeHtml(payload.date || '未設定日期');
  const tags = Array.isArray(payload.tags)
    ? payload.tags.slice(0, 20).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')
    : '';
  return `<!doctype html>
<html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: https: http:; style-src 'unsafe-inline'; frame-src https: http:;">
<style>
:root{--bg:${palette.bg};--surface:${palette.surface};--border:${palette.border};--text:${palette.text};--muted:${palette.muted};--faint:${palette.faint};--accent:${palette.accent};--blue:${palette.blue};--code:${palette.code};font-family:system-ui,sans-serif;color:var(--text);background:var(--bg)}*{box-sizing:border-box}body{margin:0;padding:clamp(1.5rem,5vw,4rem);color:var(--text);background:var(--bg);line-height:1.75}.page{max-width:760px;margin:auto}.kicker{margin:0;color:var(--accent);font:600 .68rem ui-monospace,monospace}.title{margin:.5rem 0 .8rem;color:var(--text);font:400 clamp(2.2rem,7vw,4.2rem)/1.05 Georgia,serif;overflow-wrap:anywhere}.description{max-width:60ch;margin:0;color:var(--muted);font-size:1rem}.meta{display:flex;flex-wrap:wrap;gap:.4rem;margin:1rem 0 2.5rem;color:var(--faint);font:500 .68rem ui-monospace,monospace}.meta span{padding:.12rem .45rem;border:1px solid var(--border)}.meta time{margin-right:.5rem;padding-top:.12rem}.prose{max-width:68ch;counter-reset:section}.prose h1{font:400 2.4rem Georgia,serif}.prose h2{counter-increment:section;position:relative;margin:3em 0 .85em;padding:1rem 0 0 3.2rem;border-top:1px solid var(--border);font:400 1.9rem Georgia,serif}.prose h2:before{content:'0' counter(section);position:absolute;top:1.25rem;left:0;width:2.3rem;padding-bottom:.25rem;border-bottom:4px solid var(--accent);color:var(--faint);font:600 .62rem ui-monospace,monospace}.prose h3{margin:2.2em 0 .65em;padding-left:.8rem;border-left:4px solid var(--blue);font:400 1.4rem Georgia,serif}.prose h4,.prose h5,.prose h6{margin:2em 0 .7em;font:600 1.08rem system-ui,sans-serif}.prose p{margin:0 0 1.5em}.prose ul,.prose ol{margin:0 0 1.5em;padding-left:1.75em}.prose li{margin-bottom:.4em}.prose li::marker{color:var(--accent)}.prose a{color:var(--accent);text-underline-offset:3px}.prose blockquote{position:relative;margin:2em 0;padding:1.2rem 1.3rem 1rem 2.4rem;border:1px solid var(--border);border-left:5px solid var(--accent);color:var(--muted);background:var(--surface);font-family:Georgia,serif;font-style:italic}.prose hr{margin:3em 0;border:0;border-top:1px dashed var(--border)}.prose code{padding:.12em .35em;background:var(--code);font:400 .84em ui-monospace,monospace}.prose pre{max-width:100%;margin:2em 0;padding:1rem;overflow:auto;border:1px solid var(--border);border-top:4px solid var(--blue);background:#111315;color:#eef1f2}.prose pre code{padding:0;background:transparent;color:inherit}.prose img{display:block;max-width:100%;height:auto;margin:2em auto;border:1px solid var(--border)}.prose table{width:100%;margin:2em 0;border-collapse:collapse}.prose th,.prose td{padding:.65rem;border:1px solid var(--border);text-align:left}.prose th{background:var(--code)}.callout{position:relative;margin:2em 0;padding:1rem;border:1px solid var(--border);border-left:5px solid var(--blue);background:var(--surface)}.callout-title{margin:0 0 .6rem!important;color:var(--blue);font-weight:700}.callout-icon{display:none}.embed-frame{margin:2em 0;padding:2.2rem .5rem .5rem;border:1px solid var(--border);background:var(--surface)}.embed-frame iframe{width:100%;aspect-ratio:16/9;border:0}.empty{padding:3rem 1rem;border-block:1px solid var(--border);color:var(--faint);text-align:center}
</style></head><body><main class="page"><header><p class="kicker">ARTICLE PREVIEW</p><h1 class="title">${title}</h1><p class="description">${description}</p><div class="meta"><time>${date}</time>${tags}</div></header><article class="prose">${body || '<p class="empty">開始輸入 Markdown 後，預覽會顯示在這裡。</p>'}</article></main></body></html>`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return communityJson({ error: 'invalid_content_type' }, 415);
  try {
    const payload = await request.json() as Record<string, unknown>;
    const source = typeof payload.body === 'string' ? payload.body : '';
    if (source.length > 1_500_000) return communityJson({ error: 'body_too_large' }, 413);
    const rendered = source.trim() ? (await (await processor).render(source)).code : '';
    const withPreviewAssets = rendered.replace(
      /src=(['"])\.\.\/\.\.\/assets\/posts\/([a-zA-Z0-9_./-]+)\1/g,
      (_match, quote, path) => `src=${quote}/api/admin/post-asset?path=${encodeURIComponent(path)}${quote}`,
    );
    return communityJson({ document: previewDocument(payload, withPreviewAssets) });
  } catch (error) {
    console.error('Markdown preview failed', error);
    return communityJson({ error: 'preview_failed' }, 422);
  }
};
