import { locales, messages, type Locale, type MessageKey } from '../i18n';

const STORAGE_KEY = 'locale';

function isLocale(value: string | null): value is Locale {
  return !!value && locales.includes(value as Locale);
}

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;

  const language = navigator.language.toLowerCase();
  if (language.startsWith('ja')) return 'ja';
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('en')) return 'en';
  return 'zh-TW';
}

function parseValues(element: Element): Partial<Record<Locale, string>> | null {
  const raw = element.getAttribute('data-i18n-values') ?? element.getAttribute('data-page-title-values');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function applyLocale(locale: Locale, persist = true) {
  const root = document.documentElement;
  root.dataset.locale = locale;
  root.lang = locale;
  if (persist) localStorage.setItem(STORAGE_KEY, locale);

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n as MessageKey;
    if (messages[locale][key]) element.textContent = messages[locale][key];
  });

  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach(element => {
    const key = element.dataset.i18nPlaceholder as MessageKey;
    if (messages[locale][key]) element.placeholder = messages[locale][key];
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(element => {
    const key = element.dataset.i18nAria as MessageKey;
    if (messages[locale][key]) element.setAttribute('aria-label', messages[locale][key]);
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-values]').forEach(element => {
    const values = parseValues(element);
    if (values?.[locale] != null) element.textContent = values[locale]!;
  });

  document.querySelectorAll<HTMLElement>('[data-locale-panel]').forEach(panel => {
    panel.hidden = panel.dataset.localePanel !== locale;
  });

  document.querySelectorAll<HTMLTimeElement>('[data-date]').forEach(element => {
    const date = new Date(element.dataset.date!);
    element.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
  });

  const titleValues = parseValues(document.querySelector('[data-page-title-values]') ?? root);
  if (titleValues?.[locale]) document.title = titleValues[locale] === 'Kaiyasi' ? 'Kaiyasi' : `${titleValues[locale]} — Kaiyasi`;

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  const descriptionValues = description ? parseValues(description) : null;
  if (description && descriptionValues?.[locale]) description.content = descriptionValues[locale]!;

  document.querySelectorAll<HTMLButtonElement>('[data-locale-option]').forEach(button => {
    const active = button.dataset.localeOption === locale;
    button.setAttribute('aria-checked', String(active));
  });

  window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
}

function initLocale() {
  const rootLocale = document.documentElement.dataset.locale;
  applyLocale(isLocale(rootLocale ?? null) ? rootLocale : detectLocale(), false);
}

declare global {
  interface Window { setLocale: (locale: Locale) => void; }
}

window.setLocale = locale => applyLocale(locale);
initLocale();
document.addEventListener('astro:page-load', initLocale);
