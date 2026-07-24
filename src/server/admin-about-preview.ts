import { randomUUID } from 'node:crypto';
import type { AboutContent } from './admin-about';

const previews = new Map<string, { content: AboutContent; expiresAt: number }>();
const lifetimeMs = 15 * 60_000;

function prune() {
  const now = Date.now();
  for (const [token, preview] of previews) {
    if (preview.expiresAt <= now) previews.delete(token);
  }
}

export function createAboutPreview(content: AboutContent) {
  prune();
  const token = randomUUID();
  previews.set(token, { content: structuredClone(content), expiresAt: Date.now() + lifetimeMs });
  return token;
}

export function getAboutPreview(token: string) {
  prune();
  return previews.get(token)?.content;
}
