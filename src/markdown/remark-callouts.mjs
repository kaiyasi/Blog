import { visit } from 'unist-util-visit';

const defaults = {
  note: { title: 'Note', tone: 'neutral' },
  info: { title: 'Info', tone: 'info' },
  tip: { title: 'Tip', tone: 'tip' },
  success: { title: 'Success', tone: 'success' },
  warning: { title: 'Warning', tone: 'warning' },
  danger: { title: 'Danger', tone: 'danger' },
  question: { title: 'Question', tone: 'question' },
  example: { title: 'Example', tone: 'example' },
};

function words(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return Array.isArray(node.children) ? node.children.map(words).join('') : '';
}

export function remarkCallouts(options = {}) {
  const definitions = { ...defaults, ...(options.definitions ?? {}) };

  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      const name = String(node.name || 'note').toLowerCase();
      if (name === 'embed') return;
      const safeName = /^[a-z][a-z0-9-]*$/.test(name) ? name : 'note';
      const definition = definitions[safeName] ?? {
        title: safeName.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase()),
        tone: 'custom',
      };
      const attributes = node.attributes ?? {};
      const label = node.children?.[0]?.data?.directiveLabel ? node.children[0] : null;
      const title = attributes.title || (label ? words(label) : definition.title);
      const tone = /^[a-z][a-z0-9-]*$/.test(attributes.tone || '')
        ? attributes.tone
        : definition.tone;

      node.data ||= {};
      node.data.hName = 'aside';
      node.data.hProperties = {
        className: ['callout', `callout-${safeName}`],
        dataCallout: safeName,
        dataTone: tone,
        role: ['danger', 'warning'].includes(tone) ? 'alert' : 'note',
      };

      let titleNode;
      if (label) {
        label.data ||= {};
        label.data.hName = 'p';
        label.data.hProperties = { className: ['callout-title'] };
        titleNode = label;
      } else {
        titleNode = {
          type: 'paragraph',
          data: { hName: 'p', hProperties: { className: ['callout-title'] } },
          children: [{ type: 'text', value: title }],
        };
        node.children.unshift(titleNode);
      }

      titleNode.children.unshift({
        type: 'emphasis',
        data: { hName: 'span', hProperties: { className: ['callout-icon'], ariaHidden: 'true' } },
        children: [],
      });
    });
  };
}
