import { visit } from 'unist-util-visit';

const providerNames = new Map([
  ['youtube.com', 'YouTube'],
  ['www.youtube.com', 'YouTube'],
  ['youtube-nocookie.com', 'YouTube'],
  ['www.youtube-nocookie.com', 'YouTube'],
  ['open.spotify.com', 'Spotify'],
  ['codepen.io', 'CodePen'],
  ['codesandbox.io', 'CodeSandbox'],
]);

function words(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return Array.isArray(node.children) ? node.children.map(words).join('') : '';
}

function embedUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function aspectRatio(value = '16/9') {
  const match = String(value).match(/^(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)$/);
  return match ? `${match[1]} / ${match[2]}` : '16 / 9';
}

export function remarkEmbeds() {
  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      if (String(node.name).toLowerCase() !== 'embed') return;

      const attributes = node.attributes ?? {};
      const url = embedUrl(attributes.src || attributes.url || '');
      if (!url) throw new Error(':::embed requires a valid http(s) src attribute.');

      const labelNode = node.children?.[0]?.data?.directiveLabel ? node.children[0] : null;
      const title = String(attributes.title || (labelNode ? words(labelNode) : '') || 'Embedded content');
      const provider = String(attributes.provider || providerNames.get(url.hostname) || url.hostname.replace(/^www\./, ''));
      const caption = String(attributes.caption || '');

      node.data ||= {};
      node.data.hName = 'figure';
      node.data.hProperties = {
        className: ['embed-frame'],
        dataEmbedLabel: provider,
        style: `--embed-ratio: ${aspectRatio(attributes.ratio)}`,
      };
      node.children = [
        {
          type: 'paragraph',
          data: {
            hName: 'iframe',
            hProperties: {
              src: url.href,
              title,
              loading: 'lazy',
              referrerPolicy: 'strict-origin-when-cross-origin',
              allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
              allowFullScreen: true,
            },
          },
          children: [],
        },
        ...(caption ? [{
          type: 'paragraph',
          data: { hName: 'figcaption' },
          children: [{ type: 'text', value: caption }],
        }] : []),
      ];
    });
  };
}
