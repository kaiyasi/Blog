type PostSummary = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  copyright: boolean;
  cover?: string;
};

type AdminPost = PostSummary & { body: string };

type PostPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: { all: number; published: number; draft: number };
};

type AdminTheme = 'soft' | 'dark';

const savedTheme = localStorage.getItem('kaiyasi-admin-theme');
const initialTheme: AdminTheme = savedTheme === 'dark' ? 'dark' : 'soft';
const setAdminTheme = (theme: AdminTheme) => {
  document.documentElement.dataset.adminTheme = theme;
  localStorage.setItem('kaiyasi-admin-theme', theme);
  document.querySelectorAll<HTMLButtonElement>('[data-admin-theme-toggle]').forEach(button => {
    const dark = theme === 'dark';
    const label = dark ? '切換為柔和模式' : '切換為深色模式';
    button.setAttribute('aria-checked', String(dark));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.dataset.tooltip = dark ? '柔和模式' : '深色模式';
  });
  document.dispatchEvent(new CustomEvent('admin-theme-change'));
};

setAdminTheme(initialTheme);
document.querySelectorAll<HTMLButtonElement>('[data-admin-theme-toggle]').forEach(button => {
  button.addEventListener('click', () => setAdminTheme(document.documentElement.dataset.adminTheme === 'dark' ? 'soft' : 'dark'));
});

const loginForm = document.querySelector<HTMLFormElement>('[data-login-form]');
if (loginForm) {
  const status = loginForm.querySelector<HTMLElement>('[data-login-status]')!;
  const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '正在驗證...';
    try {
      const password = new FormData(loginForm).get('password');
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? '嘗試次數過多，請稍後再試。' : '密碼不正確。');
      location.reload();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '登入失敗。';
      submit.disabled = false;
    }
  });
}

const app = document.querySelector<HTMLElement>('[data-admin-app]');
if (app) {
  const postForm = app.querySelector<HTMLFormElement>('[data-post-form]')!;
  const postList = app.querySelector<HTMLElement>('[data-post-list]')!;
  const postListStatus = app.querySelector<HTMLElement>('[data-post-list-status]')!;
  const postSaveStatus = app.querySelector<HTMLElement>('[data-post-save-status]')!;
  const postSearch = app.querySelector<HTMLInputElement>('[data-post-search]')!;
  const postState = app.querySelector<HTMLSelectElement>('[data-post-state]')!;
  const postCount = app.querySelector<HTMLElement>('[data-post-count]')!;
  const postPageCurrent = app.querySelector<HTMLElement>('[data-post-page-current]')!;
  const postPageTotal = app.querySelector<HTMLElement>('[data-post-page-total]')!;
  const previousPage = app.querySelector<HTMLButtonElement>('[data-post-page="previous"]')!;
  const nextPage = app.querySelector<HTMLButtonElement>('[data-post-page="next"]')!;
  const editorMode = app.querySelector<HTMLElement>('[data-editor-mode]')!;
  const editorTitle = app.querySelector<HTMLElement>('[data-editor-title]')!;
  const preview = app.querySelector<HTMLAnchorElement>('[data-post-preview]')!;
  const previewFrame = app.querySelector<HTMLIFrameElement>('[data-preview-frame]')!;
  const previewStatus = app.querySelector<HTMLElement>('[data-preview-status]')!;
  const slugInput = postForm.elements.namedItem('slug') as HTMLInputElement;
  const titleInput = postForm.elements.namedItem('title') as HTMLInputElement;
  const bodyInput = postForm.elements.namedItem('body') as HTMLTextAreaElement;
  let posts: PostSummary[] = [];
  let postPagination: PostPagination = { page: 1, pageSize: 25, total: 0, totalPages: 1, counts: { all: 0, published: 0, draft: 0 } };
  let activeSlug: string | null = null;
  let slugTouched = false;
  let commentsLoaded = false;
  let aboutLoaded = false;
  let activeEditorTab = 'edit';
  let previewTimer: number | undefined;
  let previewRequest: AbortController | undefined;
  let postSearchTimer: number | undefined;

  const apiError = (code?: string) => ({
    already_exists: '這個 slug 已經存在。',
    invalid_slug: 'Slug 只能使用小寫英文、數字、連字號與路徑斜線。',
    invalid_title: '請填寫文章標題。',
    invalid_description: '請填寫文章摘要。',
    invalid_date: '請確認發布日期。',
    invalid_cover: '封面必須是 src/assets/posts 下的圖片相對路徑。',
    body_too_large: '文章內容超過 1.5 MB。',
    content_sync_not_configured: '遠端同步尚未完成設定，內容只暫存在目前容器。',
    content_sync_failed: '內容已暫存，但推送 GitHub 或 GitLab 失敗，請再儲存一次。',
  }[code || ''] || '儲存失敗，請再試一次。');

  const slugify = (value: string) => value.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const previewPayload = () => {
    const data = new FormData(postForm);
    return {
      title: String(data.get('title') || ''),
      description: String(data.get('description') || ''),
      date: String(data.get('date') || ''),
      tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
      body: String(data.get('body') || ''),
      theme: document.documentElement.dataset.adminTheme || 'soft',
    };
  };

  const renderPreview = async () => {
    window.clearTimeout(previewTimer);
    previewRequest?.abort();
    previewRequest = new AbortController();
    previewStatus.textContent = '正在產生預覽...';
    try {
      const response = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewPayload()),
        signal: previewRequest.signal,
      });
      if (response.status === 401) return location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error();
      previewFrame.srcdoc = result.document;
      previewStatus.textContent = '預覽已更新';
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return;
      previewStatus.textContent = '無法產生預覽，請檢查 Markdown 語法。';
    }
  };

  const schedulePreview = () => {
    if (activeEditorTab !== 'preview') return;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(renderPreview, 450);
  };

  const setEditorTab = (tab: string) => {
    activeEditorTab = tab === 'preview' ? 'preview' : 'edit';
    app.querySelectorAll<HTMLElement>('[data-editor-panel]').forEach(panel => {
      panel.hidden = panel.dataset.editorPanel !== activeEditorTab;
    });
    app.querySelectorAll<HTMLButtonElement>('[data-editor-tab]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.editorTab === activeEditorTab));
    });
    if (activeEditorTab === 'preview') renderPreview();
  };

  const setNewPost = () => {
    activeSlug = null;
    slugTouched = false;
    postForm.reset();
    (postForm.elements.namedItem('date') as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
    (postForm.elements.namedItem('copyright') as HTMLInputElement).checked = true;
    slugInput.disabled = false;
    editorMode.textContent = 'NEW DOCUMENT';
    editorTitle.textContent = '新增文章';
    preview.hidden = true;
    postSaveStatus.textContent = '翻譯內容會在下次 build 時更新。';
    renderPosts();
    setEditorTab('edit');
    titleInput.focus();
  };

  const fillForm = (post: AdminPost) => {
    activeSlug = post.slug;
    postForm.reset();
    for (const field of ['title', 'slug', 'description', 'date', 'cover', 'body'] as const) {
      (postForm.elements.namedItem(field) as HTMLInputElement | HTMLTextAreaElement).value = post[field] || '';
    }
    (postForm.elements.namedItem('tags') as HTMLInputElement).value = post.tags.join(', ');
    (postForm.elements.namedItem('copyright') as HTMLInputElement).checked = post.copyright;
    slugInput.disabled = true;
    editorMode.textContent = post.draft ? 'DRAFT DOCUMENT' : 'PUBLISHED DOCUMENT';
    editorTitle.textContent = post.title;
    preview.href = `/posts/${encodeURIComponent(post.slug)}`;
    preview.hidden = post.draft;
    postSaveStatus.textContent = `最後讀取：${new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`;
    renderPosts();
    schedulePreview();
  };

  const renderPosts = () => {
    postCount.textContent = String(postPagination.counts.all);
    postPageCurrent.textContent = String(postPagination.page);
    postPageTotal.textContent = String(postPagination.totalPages);
    previousPage.disabled = postPagination.page <= 1;
    nextPage.disabled = postPagination.page >= postPagination.totalPages;
    postList.replaceChildren();
    const start = postPagination.total ? (postPagination.page - 1) * postPagination.pageSize + 1 : 0;
    const end = Math.min(postPagination.page * postPagination.pageSize, postPagination.total);
    postListStatus.textContent = posts.length ? `顯示 ${start}–${end}，共 ${postPagination.total} 篇` : '沒有符合條件的文章。';
    posts.forEach(post => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'post-row';
      button.setAttribute('aria-current', String(post.slug === activeSlug));
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.classList.add('post-row-icon', post.draft ? 'draft' : 'published');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '1.8');
      icon.setAttribute('stroke-linecap', 'round');
      icon.setAttribute('stroke-linejoin', 'round');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = post.draft
        ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8.5 18l.4-2.4 6.2-6.2a1.4 1.4 0 0 1 2 2l-6.2 6.2Z"/>'
        : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8.5 15.5l2 2 5-5"/>';
      const title = document.createElement('strong');
      title.textContent = post.title;
      const meta = document.createElement('span');
      const slug = document.createElement('b');
      slug.textContent = post.slug;
      const state = document.createElement('i');
      state.textContent = post.draft ? '草稿' : '已發布';
      state.className = post.draft ? 'draft' : 'published';
      meta.append(slug, state);
      button.append(icon, title, meta);
      button.addEventListener('click', () => openPost(post.slug));
      postList.append(button);
    });
  };

  const openPost = async (slug: string) => {
    postSaveStatus.textContent = '正在讀取文章...';
    try {
      const response = await fetch(`/api/admin/posts?slug=${encodeURIComponent(slug)}`);
      if (response.status === 401) return location.reload();
      if (!response.ok) throw new Error();
      fillForm((await response.json()).post);
    } catch {
      postSaveStatus.textContent = '無法讀取文章，請再試一次。';
    }
  };

  const loadPosts = async (selectFirst = true) => {
    postListStatus.textContent = '正在載入文章...';
    try {
      const parameters = new URLSearchParams({
        page: String(postPagination.page),
        pageSize: String(postPagination.pageSize),
        status: postState.value,
      });
      const query = postSearch.value.trim();
      if (query) parameters.set('q', query);
      const response = await fetch(`/api/admin/posts?${parameters}`);
      if (response.status === 401) return location.reload();
      if (!response.ok) throw new Error();
      const result = await response.json();
      posts = result.posts || [];
      postPagination = result.pagination || postPagination;
      renderPosts();
      if (selectFirst && !activeSlug && posts[0]) await openPost(posts[0].slug);
      else if (!postPagination.counts.all) setNewPost();
    } catch {
      postListStatus.textContent = '無法載入文章，請稍後再試。';
    }
  };

  titleInput.addEventListener('input', () => {
    if (!activeSlug && !slugTouched) slugInput.value = slugify(titleInput.value);
    if (!activeSlug) editorTitle.textContent = titleInput.value.trim() || '新增文章';
  });
  slugInput.addEventListener('input', () => { slugTouched = true; });
  postForm.addEventListener('input', schedulePreview);
  document.addEventListener('admin-theme-change', schedulePreview);
  postSearch.addEventListener('input', () => {
    window.clearTimeout(postSearchTimer);
    postSearchTimer = window.setTimeout(() => {
      postPagination.page = 1;
      loadPosts(false);
    }, 280);
  });
  postState.addEventListener('change', () => {
    postPagination.page = 1;
    loadPosts(false);
  });
  previousPage.addEventListener('click', () => {
    if (postPagination.page <= 1) return;
    postPagination.page -= 1;
    loadPosts(false);
  });
  nextPage.addEventListener('click', () => {
    if (postPagination.page >= postPagination.totalPages) return;
    postPagination.page += 1;
    loadPosts(false);
  });
  app.querySelector('[data-new-post]')!.addEventListener('click', setNewPost);
  app.querySelectorAll<HTMLButtonElement>('[data-editor-tab]').forEach(button => {
    button.addEventListener('click', () => setEditorTab(button.dataset.editorTab || 'edit'));
  });

  const replaceSelection = (before: string, after: string, placeholder: string) => {
    const start = bodyInput.selectionStart;
    const end = bodyInput.selectionEnd;
    const selected = bodyInput.value.slice(start, end) || placeholder;
    bodyInput.setRangeText(`${before}${selected}${after}`, start, end, 'end');
    bodyInput.focus();
    bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const prefixLines = (prefix: string, ordered = false) => {
    const start = bodyInput.selectionStart;
    const end = bodyInput.selectionEnd;
    const selected = bodyInput.value.slice(start, end) || '清單項目';
    const value = selected.split('\n').map((line, index) => `${ordered ? `${index + 1}. ` : prefix}${line}`).join('\n');
    bodyInput.setRangeText(value, start, end, 'select');
    bodyInput.focus();
    bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const insertMarkdown = (action: string) => {
    if (action === 'heading') return replaceSelection('## ', '', '標題');
    if (action === 'bold') return replaceSelection('**', '**', '粗體文字');
    if (action === 'italic') return replaceSelection('_', '_', '斜體文字');
    if (action === 'link') return replaceSelection('[', '](https://example.com)', '連結文字');
    if (action === 'quote') return prefixLines('> ');
    if (action === 'unordered-list') return prefixLines('- ');
    if (action === 'ordered-list') return prefixLines('', true);
    if (action === 'code') return replaceSelection('```text\n', '\n```', '程式碼');
    if (action === 'image') {
      const slug = activeSlug || slugInput.value || '文章-slug';
      return replaceSelection('![', `](../../assets/posts/${slug}/image.jpg)`, '圖片說明');
    }
    if (action === 'callout') return replaceSelection(':::tip[提示]\n', '\n:::', '提示內容');
    if (action === 'embed') return replaceSelection(':::embed[內容標題]{src="', '" caption="內容說明"}\n:::', 'https://example.com/embed');
  };
  app.querySelectorAll<HTMLButtonElement>('[data-md-action]').forEach(button => {
    button.addEventListener('click', () => insertMarkdown(button.dataset.mdAction || ''));
  });
  bodyInput.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const action = event.key.toLowerCase() === 'b' ? 'bold'
      : event.key.toLowerCase() === 'i' ? 'italic'
      : event.key.toLowerCase() === 'k' ? 'link' : '';
    if (!action) return;
    event.preventDefault();
    insertMarkdown(action);
  });
  const markdownEditor = app.querySelector<HTMLElement>('.markdown-editor')!;
  const syntaxDialog = app.querySelector<HTMLElement>('[data-syntax-dialog]')!;
  const syntaxOpen = app.querySelector<HTMLButtonElement>('[data-syntax-open]')!;
  markdownEditor.append(syntaxDialog);
  const setSyntaxOpen = (open: boolean) => {
    syntaxDialog.hidden = !open;
    markdownEditor.classList.toggle('syntax-open', open);
    syntaxOpen.setAttribute('aria-expanded', String(open));
  };
  syntaxOpen.addEventListener('click', () => setSyntaxOpen(syntaxDialog.hidden));
  app.querySelector('[data-syntax-close]')!.addEventListener('click', () => setSyntaxOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !syntaxDialog.hidden) setSyntaxOpen(false);
  });
  const setSyntaxTab = (tab: string) => {
    syntaxDialog.querySelectorAll<HTMLButtonElement>('[data-syntax-tab]').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.syntaxTab === tab));
    });
    syntaxDialog.querySelectorAll<HTMLElement>('[data-syntax-panel]').forEach(panel => {
      panel.hidden = panel.dataset.syntaxPanel !== tab;
    });
  };
  syntaxDialog.querySelectorAll<HTMLButtonElement>('[data-syntax-tab]').forEach(button => {
    button.addEventListener('click', () => setSyntaxTab(button.dataset.syntaxTab || 'basic'));
  });
  const copySyntax = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const temporary = document.createElement('textarea');
      temporary.value = value;
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.append(temporary);
      temporary.select();
      document.execCommand('copy');
      temporary.remove();
    }
  };
  syntaxDialog.querySelectorAll<HTMLButtonElement>('[data-copy-syntax]').forEach(button => {
    button.addEventListener('click', async () => {
      const code = document.getElementById(button.dataset.copySyntax || '');
      if (!code) return;
      await copySyntax(code.textContent || '');
      button.textContent = '✓';
      window.setTimeout(() => { button.textContent = '⧉'; }, 1200);
    });
  });
  postForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const draft = submitter?.dataset.saveAs !== 'published';
    const data = new FormData(postForm);
    const payload = {
      slug: activeSlug || String(data.get('slug') || ''),
      title: String(data.get('title') || ''),
      description: String(data.get('description') || ''),
      date: String(data.get('date') || ''),
      tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
      cover: String(data.get('cover') || ''),
      body: String(data.get('body') || ''),
      copyright: data.get('copyright') === 'on',
      draft,
    };
    const buttons = [...postForm.querySelectorAll<HTMLButtonElement>('button[type="submit"]')];
    buttons.forEach(button => { button.disabled = true; });
    postSaveStatus.textContent = draft ? '正在儲存草稿...' : '正在發布文章...';
    try {
      const url = activeSlug ? `/api/admin/posts?slug=${encodeURIComponent(activeSlug)}` : '/api/admin/posts';
      const response = await fetch(url, {
        method: activeSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) return location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'save_failed');
      activeSlug = result.post.slug;
      await loadPosts(false);
      fillForm(result.post);
      postSaveStatus.textContent = draft ? '草稿已提交，等待部署。' : '文章已提交，等待部署完成。';
    } catch (error) {
      postSaveStatus.textContent = apiError(error instanceof Error ? error.message : '');
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  });

  const aboutForm = app.querySelector<HTMLFormElement>('[data-about-form]')!;
  const aboutInput = aboutForm.elements.namedItem('content') as HTMLTextAreaElement;
  const aboutStatus = app.querySelector<HTMLElement>('[data-about-status]')!;
  const loadAbout = async () => {
    aboutStatus.textContent = '正在載入關於頁面...';
    try {
      const response = await fetch('/api/admin/about');
      if (response.status === 401) return location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'load_failed');
      aboutInput.value = JSON.stringify(result.content, null, 2);
      aboutLoaded = true;
      aboutStatus.textContent = '已載入最新內容。';
    } catch {
      aboutStatus.textContent = '無法載入關於頁面，請稍後再試。';
    }
  };
  aboutForm.addEventListener('submit', async event => {
    event.preventDefault();
    let content: unknown;
    try {
      content = JSON.parse(aboutInput.value);
    } catch {
      aboutStatus.textContent = 'JSON 格式有誤，請檢查逗號、引號與括號。';
      aboutInput.focus();
      return;
    }
    const button = aboutForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    aboutStatus.textContent = '正在儲存關於頁面...';
    try {
      const response = await fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      if (response.status === 401) return location.reload();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'save_failed');
      aboutInput.value = JSON.stringify(result.content, null, 2);
      aboutStatus.textContent = '變更已提交，等待部署完成。';
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      aboutStatus.textContent = code.startsWith('invalid_')
        ? `內容驗證失敗：${code.slice(8)}`
        : apiError(code);
    } finally {
      button.disabled = false;
    }
  });
  app.querySelector('[data-about-refresh]')!.addEventListener('click', loadAbout);

  const table = app.querySelector<HTMLElement>('[data-comment-table]')!;
  const commentStatus = app.querySelector<HTMLElement>('[data-manager-status]')!;
  const search = app.querySelector<HTMLInputElement>('[data-search]')!;
  const filter = app.querySelector<HTMLSelectElement>('[data-status-filter]')!;
  let comments: any[] = [];
  const resourceName = (resource: string) => resource === 'about' ? 'About 留言板' : resource.startsWith('post:') ? `文章 / ${resource.slice(5)}` : resource;
  const filteredComments = () => {
    const query = search.value.trim().toLowerCase();
    return comments.filter(comment => (filter.value === 'all' || comment.status === filter.value)
      && (!query || `${comment.author} ${comment.body} ${comment.resource}`.toLowerCase().includes(query)));
  };
  const renderComments = () => {
    app.querySelector<HTMLElement>('[data-stat="all"]')!.textContent = String(comments.length);
    app.querySelector<HTMLElement>('[data-stat="visible"]')!.textContent = String(comments.filter(item => item.status === 'visible').length);
    app.querySelector<HTMLElement>('[data-stat="hidden"]')!.textContent = String(comments.filter(item => item.status === 'hidden').length);
    const rows = filteredComments();
    table.replaceChildren();
    commentStatus.textContent = rows.length ? `顯示 ${rows.length} 則留言` : '沒有符合條件的留言。';
    rows.forEach(comment => {
      const article = document.createElement('article');
      article.className = 'comment-row';
      article.dataset.status = comment.status;
      const avatar = document.createElement('span');
      avatar.className = 'admin-avatar';
      if (comment.avatarUrl) {
        const image = document.createElement('img');
        Object.assign(image, { src: comment.avatarUrl, alt: '', width: 40, height: 40, loading: 'lazy', referrerPolicy: 'no-referrer' });
        avatar.append(image);
      } else avatar.textContent = comment.author.slice(0, 1).toUpperCase();
      const content = document.createElement('div');
      content.className = 'comment-content';
      const header = document.createElement('header');
      const author = document.createElement('strong');
      author.textContent = comment.author;
      const badge = document.createElement('span');
      badge.textContent = comment.status === 'visible' ? '公開' : '隱藏';
      header.append(author, badge);
      const body = document.createElement('p');
      body.textContent = comment.body;
      content.append(header, body);
      const meta = document.createElement('div');
      meta.className = 'comment-meta';
      const resource = document.createElement('strong');
      resource.textContent = resourceName(comment.resource);
      const details = document.createElement('span');
      details.textContent = `${comment.locale} · ${new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.createdAt))}`;
      meta.append(resource, details);
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = comment.status === 'visible' ? '隱藏' : '恢復公開';
      action.addEventListener('click', async () => {
        action.disabled = true;
        commentStatus.textContent = '正在更新留言狀態...';
        try {
          const nextStatus = comment.status === 'visible' ? 'hidden' : 'visible';
          const response = await fetch('/api/admin/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: comment.id, status: nextStatus }) });
          if (response.status === 401) return location.reload();
          if (!response.ok) throw new Error();
          comment.status = nextStatus;
          renderComments();
        } catch {
          commentStatus.textContent = '更新失敗，請再試一次。';
          action.disabled = false;
        }
      });
      article.append(avatar, content, meta, action);
      table.append(article);
    });
  };
  const loadComments = async () => {
    commentStatus.textContent = '正在載入留言...';
    try {
      const response = await fetch('/api/admin/comments');
      if (response.status === 401) return location.reload();
      if (!response.ok) throw new Error();
      comments = (await response.json()).comments || [];
      commentsLoaded = true;
      renderComments();
    } catch {
      commentStatus.textContent = '無法載入留言，請稍後再試。';
    }
  };

  app.querySelectorAll<HTMLButtonElement>('[data-view-target]').forEach(button => {
    button.addEventListener('click', () => {
      const view = button.dataset.viewTarget!;
      app.querySelectorAll<HTMLElement>('[data-admin-view]').forEach(section => { section.hidden = section.dataset.adminView !== view; });
      app.querySelectorAll<HTMLButtonElement>('[data-view-target]').forEach(item => item.removeAttribute('aria-current'));
      button.setAttribute('aria-current', 'page');
      if (view === 'about' && !aboutLoaded) loadAbout();
      if (view === 'comments' && !commentsLoaded) loadComments();
    });
  });
  search.addEventListener('input', renderComments);
  filter.addEventListener('change', renderComments);
  app.querySelector('[data-refresh]')!.addEventListener('click', loadComments);
  app.querySelector('[data-logout]')!.addEventListener('click', async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    location.reload();
  });

  loadPosts();
}
