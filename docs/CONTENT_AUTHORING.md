# Content authoring

Articles live in `src/content/posts/` and can use `.md` or `.mdx`.

The private `/admin` dashboard can create and edit Markdown articles in this
directory. New browser-authored articles use `.md`; existing `.mdx` files keep
their extension. Set `CONTENT_POSTS_DIRECTORY` when the source directory is
mounted somewhere else in a writable production environment.

The dashboard editor includes quick-insert controls and a syntax reference.
Markdown links use `[visible text](https://example.com)`. Reference links use
`[visible text][id]` with a matching `[id]: https://example.com` definition.

## Markdown support

Astro processes GitHub Flavored Markdown, including headings, emphasis,
links, blockquotes, ordered and unordered lists, task lists, tables,
strikethrough, autolinks, fenced code blocks, inline code, and raw HTML.
Footnotes, definition lists, and embedded Astro components should use MDX or
an explicit remark/rehype extension instead of relying on parser accidents.

The article theme includes dedicated styles for all common rendered elements:
six heading levels, emphasis and deletion, ordered/unordered/task lists,
quotes, rules, links, inline and fenced code, tables, images and captions,
definition lists, details, keyboard input, footnotes, iframes, video, audio,
objects, and embeds. Raw HTML and MDX can use the corresponding semantic
elements and will inherit the same light/dark character theme.

## Callouts

Use a container directive. The built-in names are `note`, `info`, `tip`,
`success`, `warning`, `danger`, `question`, and `example`.

```md
:::tip
This uses the default title.
:::

:::warning[Custom title]
The label and body can contain normal Markdown.
:::

:::release-note[Custom directive]{tone="tip"}
Any lowercase directive name is accepted. Unknown names use the neutral
custom style; `tone` can reuse an existing visual tone.
:::
```

Edit `src/markdown/remark-callouts.mjs` to add project-wide names and default
titles. Visual tones are defined in `src/styles/global.css`.

## Embeds

Use the embed directive for external players and interactive frames. It adds a
themed media panel, provider label, lazy loading, permissions, and a responsive
aspect ratio.

```md
:::embed[Video title]{src="https://www.youtube-nocookie.com/embed/VIDEO_ID" caption="Optional caption"}
:::

:::embed[Spotify player]{src="https://open.spotify.com/embed/track/TRACK_ID" ratio="3/1"}
:::
```

`src` must be an HTTP or HTTPS URL. `ratio` defaults to `16/9`; `provider` can
override the label shown above the frame. A native `<iframe>`, `<video>`, or
`<audio>` in Markdown/MDX is also themed, but the directive is preferred for
consistent metadata and sizing.

## Images

Keep article images under `src/assets/posts/<post-slug>/` and reference them
from Markdown with a relative path:

```md
![Useful alternative text](../../assets/posts/my-post/screenshot.png)
```

Local Markdown images are optimized during the Astro build. The global
`constrained` layout generates responsive `srcset` and `sizes` attributes.
Images under `public/` and native HTML `<img>` elements are supported but are
not optimized. Use `.mdx` with Astro's `<Image />` or `<Picture />` component
when an image needs custom widths, formats, or art direction.
