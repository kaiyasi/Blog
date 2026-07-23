import zhTW from './zh-TW.json';
import en from '../generated/i18n/messages/en.json';
import ja from '../generated/i18n/messages/ja.json';
import ko from '../generated/i18n/messages/ko.json';

export const locales = ['zh-TW', 'en', 'ja', 'ko'] as const;
export type Locale = (typeof locales)[number];
export type MessageKey = keyof typeof zhTW;

export const localeLabels: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};

export const messages: Record<Locale, Record<MessageKey, string>> = {
  'zh-TW': zhTW,
  en,
  ja,
  ko,
};

export function localizedValues(key: MessageKey) {
  return Object.fromEntries(locales.map(locale => [locale, messages[locale][key]]));
}
