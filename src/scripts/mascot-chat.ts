type Scene = 'campus' | 'stage' | 'weekend';
type Character = 'mafuyu' | 'ritsuka';
type Locale = 'zh-TW' | 'en' | 'ja' | 'ko';
type Trigger = 'arrival' | 'click' | 'rapid-click' | 'return' | 'holiday' | 'idle'
  | 'article-progress' | 'navigation' | 'nav-interaction' | 'copy-code' | 'copy-text'
  | 'article-preview' | 'search' | 'language' | 'theme';
type Zone = 'top' | 'middle' | 'end';

type HolidayRule = {
  id: string;
  calendar: 'fixed' | 'chinese';
  month: number;
  day?: number;
  dayStart?: number;
  dayEnd?: number;
  label: string;
};

type EventConfig = {
  cooldownMs: number;
  arrivalDelayMs: number;
  givenReferenceProbability: number;
  spontaneous: { enabled: boolean; delayMs: number; probability: number };
  article: { enabled: boolean; thresholds: number[] };
  holidays: HolidayRule[];
};

type ArticleContext = {
  title: string;
  description: string;
  tags: string[];
  heading?: string;
  progress: number;
};

type ArticlePreview = {
  slug: string;
  titles: Partial<Record<Locale, string>>;
  descriptions: Partial<Record<Locale, string>>;
  tags: string[];
};

const ui = {
  'zh-TW': { close: '關閉對話', labels: { mafuyu: '和真冬互動', ritsuka: '和立夏互動' }, unavailable: 'VOICE LINK OFFLINE' },
  en: { close: 'Close dialogue', labels: { mafuyu: 'Interact with Mafuyu', ritsuka: 'Interact with Ritsuka' }, unavailable: 'VOICE LINK OFFLINE' },
  ja: { close: '会話を閉じる', labels: { mafuyu: '真冬と話す', ritsuka: '立夏と話す' }, unavailable: 'VOICE LINK OFFLINE' },
  ko: { close: '대화 닫기', labels: { mafuyu: '마후유와 상호작용', ritsuka: '리츠카와 상호작용' }, unavailable: 'VOICE LINK OFFLINE' },
} as const;

const safeParse = <T>(value: string | undefined, fallback: T): T => {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};

function initMascotDock() {
  const dock = document.getElementById('mascot-dock');
  const bubble = document.getElementById('mascot-dialog');
  const message = document.getElementById('mascot-message');
  const close = document.getElementById('mascot-dialog-close') as HTMLButtonElement | null;
  if (!dock || !bubble || !message || !close || dock.dataset.enabled === 'false' || dock.dataset.bound === 'true') return;
  dock.dataset.bound = 'true';

  const assets = safeParse<Record<Scene, Record<Character, string | null>>>(dock.dataset.assets, {} as Record<Scene, Record<Character, string | null>>);
  const config = safeParse<EventConfig>(dock.dataset.events, {
    cooldownMs: 12000,
    arrivalDelayMs: 900,
    givenReferenceProbability: .18,
    spontaneous: { enabled: false, delayMs: 75000, probability: 0 },
    article: { enabled: false, thresholds: [] },
    holidays: [],
  });
  const buttons = Array.from(dock.querySelectorAll<HTMLButtonElement>('[data-mascot]'));
  const controller = new AbortController();
  const { signal } = controller;
  let requestController: AbortController | undefined;
  let hideTimer = 0;
  let reactionTimer = 0;
  let spontaneousTimer = 0;
  let arrivalTimer = 0;
  let previewTimer = 0;
  let lastClick = 0;
  let lastRequestAt = 0;
  let interactionCount = 0;
  let adminEntryClicks: number[] = [];
  let adminEntryPending = false;
  let wasVisible = false;
  let lastLocale = document.documentElement.dataset.locale;

  const locale = (): Locale => {
    const value = document.documentElement.dataset.locale as Locale;
    return ui[value] ? value : 'zh-TW';
  };
  const scene = () => (document.documentElement.dataset.scene || 'campus') as Scene;
  const character = (): Character => document.documentElement.dataset.theme === 'dark' ? 'ritsuka' : 'mafuyu';
  const activeButton = () => buttons.find(item => item.dataset.mascot === character());
  const zone = (): Zone => {
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    const progress = scrollable > 0 ? scrollY / scrollable : 0;
    return progress >= .82 ? 'end' : progress >= .25 ? 'middle' : 'top';
  };
  const todayKey = (date = new Date()) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  const currentHoliday = () => {
    const now = new Date();
    const fixed = config.holidays.find(item => item.calendar === 'fixed'
      && item.month === now.getMonth() + 1 && item.day === now.getDate());
    if (fixed) return fixed;
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric' }).formatToParts(now);
      const month = Number.parseInt(parts.find(part => part.type === 'month')?.value || '', 10);
      const day = Number.parseInt(parts.find(part => part.type === 'day')?.value || '', 10);
      return config.holidays.find(item => item.calendar === 'chinese' && item.month === month
        && day >= (item.dayStart ?? item.day ?? 1) && day <= (item.dayEnd ?? item.day ?? 1));
    } catch {
      return undefined;
    }
  };

  const articleContext = (): ArticleContext | undefined => {
    const article = document.querySelector<HTMLElement>('[data-mascot-article]');
    if (!article) return undefined;
    const base = safeParse<Omit<ArticleContext, 'progress' | 'heading'>>(article.dataset.mascotArticle, {
      title: '', description: '', tags: [],
    });
    if (!base.title || !base.description) return undefined;
    const rect = article.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight * .38 - rect.top) / Math.max(rect.height, 1)));
    const headings = Array.from(article.querySelectorAll<HTMLElement>('[data-locale-panel]:not([hidden]) h2, [data-locale-panel]:not([hidden]) h3'));
    const heading = headings.filter(item => item.getBoundingClientRect().top <= innerHeight * .42).at(-1)?.textContent?.trim();
    return { ...base, heading: heading?.slice(0, 180), progress };
  };

  const hideBubble = () => {
    window.clearTimeout(hideTimer);
    requestController?.abort();
    bubble.hidden = true;
    bubble.dataset.state = 'idle';
  };

  const showReaction = (button: HTMLButtonElement | undefined, trigger: Trigger, currentZone: Zone) => {
    if (!button) return;
    window.clearTimeout(reactionTimer);
    button.classList.remove('reaction-nod', 'reaction-jump', 'reaction-sway', 'reaction-startled');
    void button.offsetWidth;
    const effect = trigger === 'rapid-click'
      ? 'reaction-startled'
      : currentZone === 'end' || trigger === 'article-progress'
        ? 'reaction-sway'
        : scene() === 'stage'
          ? 'reaction-jump'
          : 'reaction-nod';
    button.classList.add(effect);
    reactionTimer = window.setTimeout(() => button.classList.remove(effect), 720);
  };

  const requestLine = async (trigger: Trigger, options: {
    button?: HTMLButtonElement;
    target?: string;
    holiday?: HolidayRule;
    article?: ArticleContext;
    force?: boolean;
    cooldownMs?: number;
  } = {}) => {
    const nowMs = Date.now();
    if (!options.force && nowMs - lastRequestAt < (options.cooldownMs ?? config.cooldownMs)) return false;
    lastRequestAt = nowMs;
    const currentCharacter = character();
    const currentScene = scene();
    const currentZone = zone();
    showReaction(options.button, trigger, currentZone);

    requestController?.abort();
    requestController = new AbortController();
    window.clearTimeout(hideTimer);
    dock.dataset.zone = currentZone;
    dock.dataset.speaker = currentCharacter;
    message.textContent = '';
    bubble.dataset.state = 'loading';
    bubble.hidden = false;

    const now = new Date();
    try {
      const response = await fetch('/api/mascot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: currentCharacter,
          scene: currentScene,
          locale: locale(),
          trigger,
          zone: currentZone,
          pathname: location.pathname,
          hour: trigger === 'arrival' ? now.getHours() : undefined,
          timeZone: trigger === 'arrival' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'local' : undefined,
          interactionCount,
          target: options.target?.slice(0, 120),
          referenceMode: trigger === 'idle' || (trigger !== 'article-preview' && Math.random() < config.givenReferenceProbability) ? 'given' : 'site',
          holiday: options.holiday ? { id: options.holiday.id, label: options.holiday.label } : undefined,
          article: options.article ?? articleContext(),
        }),
        signal: requestController.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { line?: string };
      if (!payload.line) throw new Error('Empty response');
      message.textContent = payload.line;
      bubble.dataset.state = 'ready';
      hideTimer = window.setTimeout(hideBubble, 11_000);
      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return false;
      if (!['click', 'rapid-click', 'return'].includes(trigger)) {
        hideBubble();
        return false;
      }
      message.textContent = ui[locale()].unavailable;
      bubble.dataset.state = 'error';
      hideTimer = window.setTimeout(hideBubble, 4_500);
      return false;
    }
  };

  const maybeArrival = () => {
    if (dock.dataset.visible !== 'true') return;
    const holiday = currentHoliday();
    if (holiday) {
      const key = `mascot-holiday:${holiday.id}:${todayKey()}`;
      const pendingKey = `${key}:pending`;
      if (!localStorage.getItem(key) && !sessionStorage.getItem(pendingKey)) {
        sessionStorage.setItem(pendingKey, '1');
        sessionStorage.setItem('mascot-arrival', '1');
        window.clearTimeout(arrivalTimer);
        arrivalTimer = window.setTimeout(async () => {
          const shown = await requestLine('holiday', { button: activeButton(), holiday });
          if (shown) localStorage.setItem(key, '1');
        }, config.arrivalDelayMs);
        return;
      }
    }

    const pending = safeParse<{ target?: string }>(sessionStorage.getItem('mascot-pending-navigation') || undefined, {});
    if (pending.target) {
      sessionStorage.removeItem('mascot-pending-navigation');
      window.clearTimeout(arrivalTimer);
      arrivalTimer = window.setTimeout(() => void requestLine('navigation', { button: activeButton(), target: pending.target }), 450);
      return;
    }

    const key = 'mascot-arrival';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    window.clearTimeout(arrivalTimer);
    arrivalTimer = window.setTimeout(() => {
      if (dock.dataset.visible === 'true') void requestLine('arrival', { button: activeButton() });
    }, config.arrivalDelayMs);
  };

  const maybeArticleProgress = () => {
    if (!config.article.enabled || dock.dataset.visible !== 'true') return;
    const article = articleContext();
    if (!article) return;
    const threshold = [...config.article.thresholds].reverse().find(value => article.progress >= value
      && !sessionStorage.getItem(`mascot-article:${location.pathname}:${value}`));
    if (threshold === undefined) return;
    config.article.thresholds
      .filter(value => value <= threshold)
      .forEach(value => sessionStorage.setItem(`mascot-article:${location.pathname}:${value}`, '1'));
    void requestLine('article-progress', {
      button: activeButton(),
      target: article.heading || article.title,
    });
  };

  const scheduleSpontaneous = () => {
    window.clearTimeout(spontaneousTimer);
    if (!config.spontaneous.enabled) return;
    spontaneousTimer = window.setTimeout(() => {
      if (dock.dataset.visible === 'true' && bubble.hidden && Math.random() < config.spontaneous.probability) {
        void requestLine('idle', { button: activeButton(), target: 'GIVEN memory' });
      }
      scheduleSpontaneous();
    }, config.spontaneous.delayMs);
  };

  const syncAssets = () => {
    const currentScene = scene();
    const selected = character();
    buttons.forEach(button => {
      const name = button.dataset.mascot as Character;
      const image = button.querySelector('img');
      const source = assets[currentScene]?.[name];
      if (image && source && image.getAttribute('src') !== source) image.setAttribute('src', source);
      button.hidden = !source || name !== selected;
    });
  };

  const syncVisibility = () => {
    const hero = document.querySelector<HTMLElement>('.hero');
    const visible = hero ? hero.getBoundingClientRect().bottom <= innerHeight * .72 : true;
    dock.dataset.visible = String(visible);
    dock.setAttribute('aria-hidden', String(!visible));
    dock.toggleAttribute('inert', !visible);
    if (visible && !wasVisible) maybeArrival();
    if (!visible) hideBubble();
    wasVisible = visible;
  };

  const syncTheme = () => {
    hideBubble();
    dock.dataset.character = character();
    syncAssets();
  };

  const syncLocale = () => {
    const currentLocale = locale();
    const copy = ui[currentLocale];
    close.setAttribute('aria-label', copy.close);
    close.title = copy.close;
    buttons.forEach(button => {
      const name = button.dataset.mascot as Character;
      button.setAttribute('aria-label', copy.labels[name]);
    });
    if (lastLocale && lastLocale !== currentLocale && dock.dataset.visible === 'true') {
      void requestLine('language', { button: activeButton(), target: currentLocale });
    }
    lastLocale = currentLocale;
  };

  const registerAdminEntryClick = (button: HTMLButtonElement) => {
    const now = performance.now();
    adminEntryClicks = adminEntryClicks.filter(time => now - time <= 4_000);
    adminEntryClicks.push(now);
    if (adminEntryClicks.length < 10 || adminEntryPending) return false;

    const elapsedMs = Math.round(now - adminEntryClicks[0]);
    adminEntryClicks = [];
    adminEntryPending = true;
    button.classList.add('reaction-jump');
    void fetch('/api/admin/entry', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clicks: 10, elapsedMs }),
    }).then(async response => {
      if (!response.ok) return;
      const payload = await response.json() as { location?: unknown };
      if (typeof payload.location === 'string' && payload.location.startsWith('/') && !payload.location.startsWith('//')) {
        location.assign(payload.location);
      }
    }).catch(() => {
      // The mascot keeps working normally if the private entrance is unavailable.
    }).finally(() => {
      adminEntryPending = false;
    });
    return true;
  };

  buttons.forEach(button => button.addEventListener('click', () => {
    const now = Date.now();
    interactionCount += 1;
    const trigger: Trigger = now - lastClick < 650 ? 'rapid-click' : interactionCount > 1 ? 'return' : 'click';
    lastClick = now;
    if (registerAdminEntryClick(button)) return;
    void requestLine(trigger, { button, force: true });
  }, { signal }));
  close.addEventListener('click', hideBubble, { signal });

  document.addEventListener('click', event => {
    const target = event.target as Element | null;
    const nav = target?.closest<HTMLElement>('[data-mascot-nav]');
    if (nav?.dataset.mascotNav) {
      sessionStorage.setItem('mascot-pending-navigation', JSON.stringify({ target: nav.dataset.mascotNav }));
    }
    const control = target?.closest<HTMLElement>('[data-mascot-control]')?.dataset.mascotControl;
    if (control === 'search') void requestLine('search', { button: activeButton(), target: 'search' });
  }, { signal });

  document.addEventListener('pointerover', event => {
    const nav = (event.target as Element | null)?.closest<HTMLElement>('[data-mascot-nav]');
    if (!nav?.dataset.mascotNav || nav.contains(event.relatedTarget as Node | null)) return;
    const key = `mascot-nav-hover:${location.pathname}:${nav.dataset.mascotNav}`;
    if (sessionStorage.getItem(key) || Math.random() >= .4) return;
    sessionStorage.setItem(key, '1');
    void requestLine('nav-interaction', { button: activeButton(), target: nav.dataset.mascotNav });
  }, { signal });

  const scheduleArticlePreview = (link: HTMLElement) => {
    if (dock.dataset.visible !== 'true') return;
    const preview = safeParse<ArticlePreview>(link.dataset.mascotPreview, {
      slug: '', titles: {}, descriptions: {}, tags: [],
    });
    if (!preview.slug) return;
    const key = `mascot-preview:${preview.slug}`;
    if (sessionStorage.getItem(key)) return;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      sessionStorage.setItem(key, '1');
      const currentLocale = locale();
      const title = preview.titles[currentLocale] || preview.titles['zh-TW'];
      const description = preview.descriptions[currentLocale] || preview.descriptions['zh-TW'];
      if (!title || !description) return;
      void requestLine('article-preview', {
        button: activeButton(),
        target: title,
        cooldownMs: 5000,
        article: { title, description, tags: preview.tags.slice(0, 12), progress: 0 },
      });
    }, 480);
  };

  document.addEventListener('pointerover', event => {
    const link = (event.target as Element | null)?.closest<HTMLElement>('[data-mascot-preview]');
    if (!link || link.contains(event.relatedTarget as Node | null)) return;
    scheduleArticlePreview(link);
  }, { signal });
  document.addEventListener('pointerout', event => {
    const link = (event.target as Element | null)?.closest<HTMLElement>('[data-mascot-preview]');
    if (!link || link.contains(event.relatedTarget as Node | null)) return;
    window.clearTimeout(previewTimer);
  }, { signal });
  document.addEventListener('focusin', event => {
    const link = (event.target as Element | null)?.closest<HTMLElement>('[data-mascot-preview]');
    if (link) scheduleArticlePreview(link);
  }, { signal });

  document.addEventListener('copy', () => {
    const selected = window.getSelection()?.toString().trim();
    if (selected) void requestLine('copy-text', { button: activeButton(), target: selected.slice(0, 80) });
  }, { signal });

  addEventListener('mascotinteraction', event => {
    const detail = (event as CustomEvent<{ trigger?: Trigger; target?: string }>).detail;
    if (!detail?.trigger) return;
    void requestLine(detail.trigger, { button: activeButton(), target: detail.target });
  }, { signal });
  addEventListener('scenechange', () => {
    hideBubble();
    syncAssets();
    maybeArrival();
  }, { signal });
  addEventListener('localechange', syncLocale, { signal });
  addEventListener('themechange', event => {
    syncTheme();
    const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme;
    if (dock.dataset.visible === 'true') void requestLine('theme', { button: activeButton(), target: theme });
  }, { signal });
  addEventListener('scroll', () => {
    syncVisibility();
    maybeArticleProgress();
  }, { passive: true, signal });
  addEventListener('resize', syncVisibility, { passive: true, signal });
  const timeCheck = window.setInterval(() => {
    if (dock.dataset.visible === 'true' && bubble.hidden) maybeArrival();
  }, 60_000);
  document.addEventListener('astro:before-swap', () => {
    window.clearInterval(timeCheck);
    window.clearTimeout(hideTimer);
    window.clearTimeout(reactionTimer);
    window.clearTimeout(spontaneousTimer);
    window.clearTimeout(arrivalTimer);
    window.clearTimeout(previewTimer);
    requestController?.abort();
    controller.abort();
  }, { once: true, signal });

  syncAssets();
  syncLocale();
  syncVisibility();
  scheduleSpontaneous();
}

initMascotDock();
document.addEventListener('astro:page-load', initMascotDock);
