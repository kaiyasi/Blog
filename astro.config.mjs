// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { remarkEmbeds } from './src/markdown/remark-embeds.mjs';
import { remarkCallouts } from './src/markdown/remark-callouts.mjs';

export default defineConfig({
  site: 'https://kaiyasi.dev',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  devToolbar: {
    enabled: false,
  },
  integrations: [
    mdx(),
    sitemap(),
  ],
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  markdown: {
    processor: unified({ remarkPlugins: [remarkDirective, remarkEmbeds, remarkCallouts] }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
