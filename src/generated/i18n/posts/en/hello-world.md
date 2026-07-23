---
title: 'Hello, World'
description: 'The first post, used to test the features of this blog.'
date: 2026-07-07
tags: ['meta', 'astro']
copyright: true
---

This is the first post.

## This is an H2 heading

A paragraph of body text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Code test

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

### This is an H3 heading

Inline code: `const greeting = 'hello'`.

> Mafuyu's voice was like a key, opening a door Ritsuka had long forgotten to lock.

## Closing

That is all for the first post.
