// ── 版權設定（全站統一修改這裡）────────────────────────────
const COPYRIGHT_CONFIG = {
  author: 'Kaiyasi',
  site: 'https://kaiyasi.dev',
  minLength: 30, // 少於這個字元數不附加版權
  messages: {
    'zh-TW': (url: string) => `\n\n來源：Kaiyasi · ${url}`,
    en: (url: string) => `\n\nSource: Kaiyasi · ${url}`,
    ja: (url: string) => `\n\n出典：Kaiyasi · ${url}`,
    ko: (url: string) => `\n\n출처: Kaiyasi · ${url}`,
  },
} as const;

function getLang(): keyof typeof COPYRIGHT_CONFIG.messages {
  const lang = document.documentElement.lang;
  return lang === 'en' || lang === 'ja' || lang === 'ko' ? lang : 'zh-TW';
}

function buildNotice(url: string): string {
  const lang = getLang();
  return COPYRIGHT_CONFIG.messages[lang](url);
}

function initCopyright() {
  const el = document.querySelector('[data-copyright="true"]');
  if (!el || document.documentElement.dataset.copyrightBound === 'true') return;
  document.documentElement.dataset.copyrightBound = 'true';

  document.addEventListener('copy', (e: ClipboardEvent) => {
    if (!document.querySelector('[data-copyright="true"]')) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selected = selection.toString();
    if (selected.length < COPYRIGHT_CONFIG.minLength) return;

    const notice = buildNotice(window.location.href);
    e.clipboardData?.setData('text/plain', selected + notice);
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('mascotinteraction', {
      detail: { trigger: 'copy-text', target: selected.slice(0, 80) },
    }));
  });
}

initCopyright();
document.addEventListener('astro:after-swap', initCopyright);
