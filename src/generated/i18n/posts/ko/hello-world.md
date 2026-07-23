---
title: 'Hello, World'
description: '블로그의 여러 기능을 시험하기 위한 첫 번째 글입니다.'
date: 2026-07-07
tags: ['meta', 'astro']
copyright: true
---

첫 번째 글입니다.

## H2 제목

본문 문단입니다. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## 코드 테스트

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

### H3 제목

인라인 코드: `const greeting = 'hello'`.

> 마후유의 목소리는 열쇠처럼, 리츠카가 잠근 것조차 잊고 있던 문을 열었다.

## 마무리

첫 번째 글은 여기까지입니다.
