import type { APIRoute } from 'astro';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { isAdminAuthenticated } from '../../../server/admin-auth';
import { validateAboutContent } from '../../../server/admin-about';
import { communityJson, sameOrigin } from '../../../server/community-http';

export const prerender = false;

const processor = createMarkdownProcessor();
const escape = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const markdown = async (source: string) => (await (await processor).render(source)).code;

async function previewDocument(value: unknown, dark: boolean) {
  const content = validateAboutContent(value);
  const { identity, about, skillGroups, roadmap, projects, experience, connect } = content;
  const aboutItems = await Promise.all(about.items.map(markdown));
  const roadmapItems = await Promise.all(roadmap.items.map(item => markdown(item.body)));
  const projectItems = await Promise.all(projects.items.map(item => markdown(item.body)));
  const experienceItems = await Promise.all(experience.items.map(item => markdown(item.role)));
  const palette = dark
    ? { bg: '#171b1c', surface: '#222728', border: '#424a4c', text: '#eef0ed', muted: '#aeb6b7', accent: '#da7068', blue: '#69a9bb' }
    : { bg: '#deded8', surface: '#ecebe5', border: '#b6b8b3', text: '#252a2b', muted: '#5f6768', accent: '#c95d55', blue: '#43869a' };
  const quote = (item: { text: string; source: string }) => `<blockquote><p>${escape(item.text)}</p><cite>${escape(item.source)}</cite></blockquote>`;
  const rows = (items: string[]) => items.map((item, index) => `<article><small>${String(index + 1).padStart(2, '0')}</small><div>${item}</div></article>`).join('');
  return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline';"><style>
*{box-sizing:border-box}html{color:${palette.text};background:${palette.bg};font-family:system-ui,sans-serif}body{margin:0}.shell{width:min(980px,100%);margin:auto;padding:0 1.5rem}.identity{padding:4rem 0;border-bottom:1px solid ${palette.border};background:${palette.surface}}.identity .shell{display:grid;grid-template-columns:180px 1fr;gap:3rem;align-items:center}.identity img{width:180px;aspect-ratio:1;border:1px solid ${palette.border};border-radius:50%;object-fit:cover}.eyebrow,small{color:${palette.accent};font:600 .62rem ui-monospace,monospace}.identity h1{margin:.35rem 0 0;font:400 3.8rem/1 Georgia,serif}.alias{margin:.45rem 0;color:${palette.blue};font:600 .65rem ui-monospace,monospace}.intro{color:${palette.muted}}.social{display:flex;flex-wrap:wrap;gap:.6rem 1rem;margin-top:1.2rem}.social a,.connect a{color:inherit;text-decoration:none;border-bottom:1px solid ${palette.border}}.section{display:grid;grid-template-columns:150px 1fr;gap:3rem;padding:4rem 0;border-bottom:1px solid ${palette.border}}.section h2{margin:.35rem 0;font:400 1.8rem Georgia,serif}.copy{min-width:0;color:${palette.muted};line-height:1.7}.copy>p:first-child{margin-top:0}.statement{color:${palette.text};font:400 1.1rem Georgia,serif}.list{margin-top:1.5rem;padding:0;list-style:none;border-top:1px solid ${palette.border}}.list li{padding:1rem 0;border-bottom:1px solid ${palette.border}}.list p{margin:0}.skills{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:${palette.border}}.skills section{padding:1rem;background:${palette.surface}}.skills h3{margin:0 0 .7rem}.skills ul{display:flex;flex-wrap:wrap;gap:.4rem;margin:0;padding:0;list-style:none}.skills li{padding:.25rem .45rem;border:1px solid ${palette.border};font-size:.72rem}.rows{border-top:1px solid ${palette.border}}.rows article{display:grid;grid-template-columns:42px 1fr;gap:1rem;padding:1rem 0;border-bottom:1px solid ${palette.border}}.rows h3{margin:0;color:${palette.text};font-size:.95rem}.rows p{margin:.35rem 0 0}.rows a{color:${palette.blue}}blockquote{margin:2rem 0 0;padding:1rem 1.2rem;border-left:4px solid ${palette.accent};background:${palette.surface}}blockquote p{margin:0;color:${palette.text};font-family:Georgia,serif}blockquote cite{display:block;margin-top:.4rem;color:${palette.muted};font-size:.7rem}.connect{display:grid}.connect a{display:grid;grid-template-columns:150px 1fr;padding:.8rem 0}.connect span{overflow-wrap:anywhere}.markdown a{color:${palette.blue}}@media(max-width:650px){.shell{padding:0 1rem}.identity .shell{grid-template-columns:1fr;text-align:center}.identity img{margin:auto}.identity h1{font-size:3rem}.section{grid-template-columns:1fr;gap:1.2rem;padding:3rem 0}.skills{grid-template-columns:1fr}.connect a{grid-template-columns:1fr;gap:.25rem}}
</style></head><body><section class="identity"><div class="shell"><img src="${escape(identity.avatar)}" alt="${escape(identity.avatarAlt)}"><div><p class="eyebrow">ABOUT ME</p><h1>${escape(identity.name)}</h1><p class="alias">${escape(identity.alias)}</p><strong>${escape(identity.subtitle['zh-TW'])}</strong><p class="intro">${escape(identity.intro['zh-TW'])}</p>${quote(identity.quote)}<nav class="social">${identity.socialLinks.map(link => `<a href="${escape(link.url)}">${escape(link.label)} ↗</a>`).join('')}</nav></div></div></section><main class="shell">
<section class="section"><header><small>01</small><h2>About Me</h2></header><div class="copy markdown"><div>${await markdown(about.opening)}</div><div class="statement">${await markdown(about.statement)}</div><ul class="list">${aboutItems.map(item => `<li>${item}</li>`).join('')}</ul>${quote(about.quote)}</div></section>
<section class="section"><header><small>02</small><h2>Skills</h2></header><div class="skills">${skillGroups.map(group => `<section><h3>${escape(group.title)}</h3><ul>${group.items.map(item => `<li>${escape(item)}</li>`).join('')}</ul></section>`).join('')}</div></section>
<section class="section"><header><small>03</small><h2>Roadmap</h2></header><div class="copy rows markdown">${rows(roadmap.items.map((item, index) => `<h3>${escape(item.title)}</h3>${roadmapItems[index]}`))}${quote(roadmap.quote)}</div></section>
<section class="section"><header><small>04</small><h2>Projects</h2></header><div class="copy rows markdown">${rows(projects.items.map((item, index) => `<h3><a href="${escape(item.url)}">${escape(item.title)} ↗</a></h3>${projectItems[index]}`))}${quote(projects.quote)}</div></section>
<section class="section"><header><small>05</small><h2>Experience</h2></header><div class="copy rows markdown">${rows(experience.items.map((item, index) => `<h3>${escape(item.title)}</h3>${experienceItems[index]}`))}${quote(experience.quote)}</div></section>
<section class="section"><header><small>06</small><h2>Connect</h2></header><div class="copy connect">${connect.items.map(item => `<a href="${escape(item.url)}"><small>${escape(item.label)}</small><span>${escape(item.value)}</span></a>`).join('')}${quote(connect.quote)}</div></section>
</main></body></html>`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthenticated(request)) return communityJson({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return communityJson({ error: 'origin_not_allowed' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return communityJson({ error: 'invalid_content_type' }, 415);
  try {
    const payload = await request.json() as { content?: unknown; theme?: string };
    return communityJson({ document: await previewDocument(payload.content, payload.theme === 'dark') });
  } catch (error) {
    console.error('About preview failed', error);
    return communityJson({ error: 'preview_failed' }, 422);
  }
};
