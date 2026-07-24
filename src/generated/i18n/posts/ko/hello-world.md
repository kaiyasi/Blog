---
title: 'Hello, World'
description: '첫 번째 글로, Blog의 여러 기능을 테스트하기 위한 글입니다.'
date: 2026-07-07
tags: ['meta', 'astro']
draft: true
copyright: true
---

첫 번째 글입니다.

## H2 제목입니다

본문 단락입니다. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

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

### H3 제목입니다

인라인 코드: `const greeting = 'hello'`.

> 인용 블록입니다. Mafuyu의 목소리는 마치 열쇠처럼, Ritsuka가 오래전에 잠갔다는 사실조차 잊은 문을 열었습니다.

## 마무리

첫 번째 글은 여기까지입니다.
