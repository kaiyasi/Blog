---
title: 'Hello, World'
description: 'これは最初の記事で、ブログの各機能をテストするためのものです。'
date: 2026-07-07
tags: ['meta', 'astro']
draft: true
copyright: true
---

これは最初の記事です。

## これは H2 見出しです

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

### これは H3 見出しです

インラインコード：`const greeting = 'hello'`。

> これは引用ブロックです。真冬の声は、まるで鍵のように、立夏がとうに鍵をかけたことさえ忘れていた扉を開いた。

## まとめ

最初の記事はここまでです。
