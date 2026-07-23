function initCodeBlocks() {
  const pres = document.querySelectorAll<HTMLPreElement>('pre.astro-code');

  pres.forEach(pre => {
    if (pre.dataset.enhanced === 'true') return;
    pre.dataset.enhanced = 'true';

    // Wrap in relative container
    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrapper';
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    // Add line numbers class
    pre.classList.add('has-line-numbers');
    const code = pre.querySelector('code');
    if (code && !code.querySelector(':scope > .line')) {
      // Fallback for highlighters that do not emit line wrappers.
      const lines = code.innerHTML.split('\n');
      // Remove trailing empty line
      if (lines[lines.length - 1] === '') lines.pop();
      code.innerHTML = lines.map(l => `<span class="line">${l}</span>`).join('\n');
    }

    // Copy button
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      Copy
    `;

    btn.addEventListener('click', async () => {
      const text = pre.querySelector('code')?.innerText ?? '';
      await navigator.clipboard.writeText(text);
      window.dispatchEvent(new CustomEvent('mascotinteraction', {
        detail: { trigger: 'copy-code', target: text.slice(0, 80) },
      }));
      btn.classList.add('copied');
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied
      `;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        `;
      }, 2000);
    });

    wrapper.appendChild(btn);
  });
}

initCodeBlocks();
document.addEventListener('astro:after-swap', initCodeBlocks);
