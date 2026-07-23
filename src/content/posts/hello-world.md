---
title: 'Hello, World'
description: '這是第一篇文章，用來測試 Blog 的各項功能。'
date: 2026-07-07
tags: ['meta', 'astro']
draft: true
copyright: true
---

這是第一篇文章。

## 這是 H2 標題

內文段落。Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## 程式碼測試

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

### 這是 H3 標題

行內程式碼：`const greeting = 'hello'`。

> 這是引用區塊。Mafuyu 的聲音，像一把鑰匙，開了立夏早就忘了鎖上的門。

## 結尾

第一篇文章到此為止。
