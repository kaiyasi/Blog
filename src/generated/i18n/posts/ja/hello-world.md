---
title: 'Hello, World'
description: 'ブログの各機能を試すための最初の記事です。'
date: 2026-07-07
tags: ['meta', 'astro']
copyright: true
---

これは最初の記事です。

## H2見出し

本文の段落です。Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## コードのテスト

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
  }),
});
```

### H3見出し

インラインコード：`const greeting = 'hello'`。

> 真冬の声は鍵のように、立夏が鍵をかけたことさえ忘れていた扉を開いた。

## おわりに

最初の記事はここまでです。
