---
title: 'Hello, World'
description: 'This is the first post, created to test the various features of the blog.'
date: 2026-07-07
tags: ['meta', 'astro']
draft: true
copyright: true
---

This is the first post.

## This Is an H2 Heading

Body paragraph. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Code Test

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

### This Is an H3 Heading

Inline code: `const greeting = 'hello'`.

> This is a blockquote. Mafuyu's voice was like a key, opening a door Ritsuka had long forgotten he'd locked.

## Conclusion

That concludes the first post.
