import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.cwd(), 'src/content/posts/admin-preview');
const topics = ['Astro', '生活紀錄', '音樂', '開發筆記', '校園', '作品進度'];
const baseDate = new Date('2026-07-23T00:00:00Z');

await mkdir(directory, { recursive: true });

for (let index = 1; index <= 100; index += 1) {
  const number = String(index).padStart(3, '0');
  const topic = topics[(index - 1) % topics.length];
  const date = new Date(baseDate);
  date.setUTCDate(baseDate.getUTCDate() - index + 1);
  const source = `---
title: '[預覽] 佔位文章 ${number}'
description: '用來檢查大量文章分頁、搜尋與草稿狀態的第 ${number} 篇測試內容。'
date: '${date.toISOString().slice(0, 10)}'
tags: ['Placeholder', '${topic}']
draft: true
copyright: true
---

## 佔位文章 ${number}

這篇草稿用來測試文章數量增加後的後台呈現，不會顯示在公開文章列表。

### ${topic}

- 分頁索引測試
- 關鍵字搜尋測試
- Markdown 預覽測試

[測試連結](https://example.com/placeholder-${number})

:::tip[草稿提示]
這是第 ${number} 篇佔位文章，可以在後台安全編輯。
:::
`;
  await writeFile(resolve(directory, `placeholder-${number}.md`), source, 'utf8');
}

console.log(`Generated 100 draft placeholder posts in ${directory}`);
