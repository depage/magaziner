/**
 * @file    magaziner.ts
 *
 * Adds a magazine-like navigation to a website.
 *
 * Copyright (c) 2013-2026 Frank Hellenkamp [jonas@depage.net]
 *
 * @author    Frank Hellenkamp [jonas@depage.net]
 */

// @todo update magaziner not to add all pages but only keep three current pages and add on request

import './magaziner.scss';

export interface MagazineOptions {
    scrollOffset: number;
    preloadPageTimeout: number;
    threshold: number;
    keyboardNavigation: boolean;
    touchNavigation: boolean;
    wrapAround: boolean;
}

export interface PageData {
    contentHtml: string;
    classes: string;
    title: string;
    meta: Array<{ name: string; content: string }>;
    ldjson: NodeListOf<HTMLScriptElement>;
    links: NodeListOf<HTMLLinkElement>;
    body: HTMLElement;
}

interface MagazineNodeData {
    loaded: boolean;
    loading: boolean;
    attached: boolean;
    title?: string;
    meta?: Array<{ name: string; content: string }>;
    classes?: string;
    ldjson?: NodeListOf<HTMLScriptElement>;
    links?: NodeListOf<HTMLLinkElement>;
}

type HtmlElementWithMagaziner = HTMLElement & { __magaziner?: MagazineNodeData };

class MagazineNavigator {
    static defaultOptions: Readonly<MagazineOptions> = {
        scrollOffset: 0,
        preloadPageTimeout: 1000,
        threshold: 30,
        keyboardNavigation: true,
        touchNavigation: true,
        wrapAround: false
    };

    static readonly _hasTouch = 'ontouchstart' in window || ('maxTouchPoints' in navigator && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 0);
    static readonly _isSmoothScrollSupported = 'scrollBehavior' in document.documentElement.style;
    static readonly _downloadExtRegexp = /\.(pdf|zip|m4v|mp4|mp3|jpg|jpeg|png|webp|docx|pptx)$/i;

    // {{{ _getRootUrl()
    static _getRootUrl(container?: HTMLElement): string {
        const baseUrl = document.querySelector("head base")?.getAttribute("href") || false;
        if (baseUrl && typeof baseUrl === 'string' && baseUrl.charAt(baseUrl.length - 1) !== "/") {
            return baseUrl + "/";
        }
        return (baseUrl && typeof baseUrl === 'string') ? baseUrl : (window.location.origin + "/");
    }
    // }}}

    // {{{ _isInternalUrl
    static _isInternalUrl(url: string, rootUrl: string): boolean {
        if (this._downloadExtRegexp.test(url)) return false;
        const normalizedRoot = rootUrl;
        return url.substring(0, normalizedRoot.length) === normalizedRoot || url.indexOf(':') === -1;
    }
    // }}}

    // {{{ _makeAbsolute
    static _makeAbsolute(rootUrl: string | null, base: string, relative: string): string {
        if (typeof relative === "undefined") return relative;
        if (relative && relative.match(/^(https?:\/\/|\/|data:|mailto:|tel:|call:)/)) return relative;
        if (rootUrl) {
            const normalizedRootUrl = rootUrl.endsWith('/') ? rootUrl : rootUrl + '/';
            return normalizedRootUrl + relative;
        }
        const stack = base.split("/");
        const parts = relative.split("/");
        stack.pop();
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === ".") continue;
            if (parts[i] === "..") stack.pop();
            else stack.push(parts[i]);
        }
        return stack.join("/");
    }
    // }}}

    // {{{ _parsePageContent
    static _parsePageContent(htmlString: string, rootUrl: string): PageData {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const body = (doc.querySelector('body')) as HTMLElement | null || doc.body;
        const page = (body.querySelector('.page')) as HTMLElement | null || body;

        const title = ((body as HTMLElement).querySelector('title')?.textContent) || doc.title;
        const metaTags = (doc.querySelectorAll('meta[name], meta[property]')) as NodeListOf<HTMLMetaElement>;
        const ldjson = (doc.querySelectorAll("script[type='application/ld+json']")) as NodeListOf<HTMLScriptElement>;
        const links = (doc.querySelectorAll("link[rel='canonical'], link[rel='alternate'], link[rel='icon']")) as NodeListOf<HTMLLinkElement>;
        const bodyClasses = ((body as HTMLElement).getAttribute('class')) || '';

        const allLinks = (body.querySelectorAll("a[href]")) as NodeListOf<HTMLAnchorElement>;
        for (let i = 0; i < allLinks.length; i++) {
            const el = allLinks[i];
            const attr = el.getAttribute('href');
            el.setAttribute('href', this._makeAbsolute(rootUrl, document.location.href, (attr || '')));
        }

        const allImgs = (body.querySelectorAll("img")) as NodeListOf<HTMLImageElement>;
        for (let i = 0; i < allImgs.length; i++) {
            const el = allImgs[i];
            const attr = el.getAttribute('src');
            if (attr) el.setAttribute('src', this._makeAbsolute(rootUrl, document.location.href, attr));
        }

        const allIframes = (body.querySelectorAll("iframe")) as NodeListOf<HTMLIFrameElement>;
        for (let i = 0; i < allIframes.length; i++) {
            const el = allIframes[i];
            const attr = el.getAttribute('src');
            if (attr) el.setAttribute('src', this._makeAbsolute(rootUrl, document.location.href, attr));
        }

        return {
            contentHtml: (page as HTMLElement).innerHTML,
            classes: bodyClasses,
            title,
            meta: Array.from(metaTags).map(m => ({ name: (m.getAttribute('name') || m.getAttribute('property')) || '', content: m.getAttribute('content') || '' })),
            ldjson,
            links,
            body
        };
    }
    // }}}

    // {{{ _createNode
    static _createNode(htmlString: string): HTMLElement | DocumentFragment {
        const range = document.createRange();
        const fragment = range.createContextualFragment(htmlString);
        return (fragment.children[0] as HTMLElement) || fragment;
    }
    // }}}

    // {{{ _dispatchEvent
    static _dispatchEvent(container: HTMLElement, eventName: string, detail?: Record<string, unknown>): void {
        container.dispatchEvent(new CustomEvent(`depage-magaziner:${eventName}`, {
            detail: detail || {},
            bubbles: true,
            cancelable: true
        }));
    }
    // }}}

    // {{{ Instance properties
    _container!: HTMLElement;
    _pagelinkSelector!: string;
    options!: MagazineOptions;
    currentPage!: number;
    _rootUrl!: string;
    _pagesByUrl!: Record<string, number>;
    _urlsByPages!: string[];
    _pageHtml!: string;
    _resizeTimer: ReturnType<typeof setTimeout> | null;
    _preloadPageTimer: ReturnType<typeof setTimeout> | null;
    _scrollY: number;
    _history!: History;
    _currentPage: HtmlElementWithMagaziner | null;
    _prevPage!: HtmlElementWithMagaziner;
    _nextPage!: HtmlElementWithMagaziner;
    _pageWidth: number;
    _moving: boolean;
    _startX: number;
    _prevEnabled: boolean;
    _nextEnabled: boolean;
    _pointerStartTime: number;
    _handlingPopState: boolean;
    // }}}

    // {{{ constructor
    constructor(container: HTMLElement, pagelinkSelector: string, options?: Partial<MagazineOptions>) {
        if (!('PointerEvent' in window)) {
            console.warn('[@depage/magaziner] Pointer Events not supported. Magaziner navigation disabled.');
            return;
        }

        (container as HtmlElementWithMagaziner).__magaziner = this as unknown as MagazineNodeData;
        this._container = container;
        this._pagelinkSelector = pagelinkSelector;
        this.options = Object.assign({}, MagazineNavigator.defaultOptions, options || {}) as MagazineOptions;
        this.currentPage = -1;
        this._rootUrl = MagazineNavigator._getRootUrl(container);

        this._pagesByUrl = {};
        this._urlsByPages = [];
        this._pageHtml = '<div class="page"></div>';
        this._resizeTimer = null;
        this._preloadPageTimer = null;
        this._scrollY = 0;
        this._history = window.history;

        this._currentPage = null;
        this._prevPage = null as unknown as HtmlElementWithMagaziner;
        this._nextPage = null as unknown as HtmlElementWithMagaziner;
        this._pageWidth = this._container.offsetWidth;
        this._moving = false;
        this._startX = 0;
        this._prevEnabled = true;
        this._nextEnabled = true;

        const htmlEl = document.documentElement;
        htmlEl.classList.add(MagazineNavigator._hasTouch ? 'has-touch' : 'no-touch');

        this._initPageLinks();
        this._registerEvents();

        const currentPageEl = this._container.querySelector('.page.current-page') || this._container.querySelector('.page');
        if (currentPageEl) {
            this._currentPage = (currentPageEl as HtmlElementWithMagaziner);
        }

        this._prevPage = this._getNewPage();
        this._nextPage = this._getNewPage();

        MagazineNavigator._dispatchEvent(this._container, 'initialized');

        setTimeout(() => {
            this.show(this.currentPage);
            this._schedulePagePreload();
        }, 50);
    }
    // }}}

    // {{{ _initPageLinks
    _initPageLinks(): void {
        const pagelinks = (document.querySelectorAll(this._pagelinkSelector)) as NodeListOf<HTMLAnchorElement>;
        this._pagesByUrl = {};
        this._urlsByPages = [];

        for (let i = 0; i < pagelinks.length; i++) {
            let url = pagelinks[i].href;
            if (pagelinks[i].getAttribute('href') === "") {
                url = document.location.href;
            }
            url = url.replace(/#.*/, '');

            if (typeof this._pagesByUrl[url] === 'undefined') {
                this._pagesByUrl[url] = this._urlsByPages.length;
                this._urlsByPages.push(url);
            }
        }

        const currentLocation = document.location.href.replace(/#.*/, '');
        if (typeof this._pagesByUrl[currentLocation] === 'undefined') {
            this.currentPage = -1;
        } else {
            this.currentPage = this._pagesByUrl[currentLocation];
        }
    }
    // }}}

    // {{{ _registerLinkClicks
    _registerLinkClicks(): void {
        document.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
            if (!target) return;
            if (target.classList.contains('no-ajaxy')) return;
            const href = target.getAttribute('href');
            if (typeof href === 'undefined') return;
            if (!MagazineNavigator._isInternalUrl(href, this._rootUrl)) return;

            target.setAttribute('href', target.href);

            if ((e as PointerEvent).button === 2 || e.metaKey) return;
            target.blur();

            const urlPath = target.href.replace(/#.*/, '');
            const hash = target.hash;

            if (typeof this._pagesByUrl[urlPath] !== 'undefined') {
                this.show(this._pagesByUrl[urlPath], true, hash);
            } else {
                this.load(target.href);
            }
            e.preventDefault();
        });
    }
    // }}}

    // {{{ _registerEvents
    _registerEvents(): void {
        if (this.options.touchNavigation) {
            this._registerPointerEvents();
        }
        if (this.options.keyboardNavigation) {
            this._registerKeyboardEvents();
        }
        this._registerResizeEvent();
        this._registerPopStateEvent();
        this._registerStateChangeCompleteEvent();
        this._registerLinkClicks();
    }
    // }}}

    // {{{ _registerPointerEvents
    _registerPointerEvents(): void {
        const container = this._container;
        const options = this.options;

        container.addEventListener('touchstart', (e: TouchEvent) => {
            if ((e as unknown as PointerEvent).pointerType === 'mouse') return;
            if (this._urlsByPages.length <= 1) return;

            if (this._hasTextSelected()) return;

            this._startX = e.touches[0].clientX;
            this._moving = false;
            this._pointerStartTime = performance.now();
            container.style.userSelect = 'none';
        }, { passive: true });

        container.addEventListener('touchmove', (e: TouchEvent) => {
            if ((e as unknown as PointerEvent).pointerType === 'mouse') return;
            if (this._urlsByPages.length <= 1) return;

            if (this._hasTextSelected()) return;

            container.classList.remove('animated');

            let dx = e.changedTouches[0].clientX - this._startX;
            const threshold = options.threshold || 30;

            if (Math.abs(dx) > threshold) {
                this._moving = true;
            }

            if (!this._moving) return;

            if (this.options.wrapAround) {
                // allow movement
            } else if (dx > 0 && (this.currentPage === 0 || !this._prevEnabled)) {
                dx = 0;
            } else if (dx < 0 && (this.currentPage >= (this._urlsByPages.length - 1) || !this._nextEnabled)) {
                dx = 0;
            }

            this._scrollY = window.scrollY;
            this._offsetPages(dx);
        }, { passive: true });

        container.addEventListener('touchend', (e: TouchEvent) => {
            if ((e as unknown as PointerEvent).pointerType === 'mouse') return;
            if (this._hasTextSelected()) {
                container.style.userSelect = '';
                return;
            }
            if (this.options.touchNavigation || this.options.keyboardNavigation) {
                this._container.classList.add('animated');
            }
            container.style.userSelect = '';
            if (this._urlsByPages.length <= 1) {
                this._offsetPages(0);
                return;
            }

            const dx = e.changedTouches[0].clientX - this._startX;
            const minMovement = container.offsetWidth / 6;

            if (!this._moving) {
                this._offsetPages(0);
                return;
            }

            const elapsed = performance.now() - this._pointerStartTime;
            const velocity = Math.abs(dx) / (elapsed || 1);

            if (this._nextEnabled && (dx < -minMovement || (dx < 0 && velocity > 0.5))) {
                this.next();
            } else if (this._prevEnabled && (dx > minMovement || (dx > 0 && velocity > 0.5))) {
                this.prev();
            } else {
                this._offsetPages(0);
            }
            this.enable();
        }, { passive: true });
    }
    // }}}

    // {{{ _hasTextSelected
    _hasTextSelected(): boolean {
        const selection = window.getSelection();
        return !!(selection && selection.toString().length > 0);
    }
    // }}}

    // {{{ _registerKeyboardEvents
    _registerKeyboardEvents(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (document.activeElement?.matches('input, textarea, select')) return;
            const fullscreen = this._container.querySelector('.fullscreen');
            if (fullscreen && (fullscreen as HTMLElement).offsetWidth > 0) return;

            if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;

            const key = e.key || String.fromCharCode(e.keyCode);
            switch (key) {
                case 'ArrowRight':
                case 'l':
                    this.next();
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                case 'h':
                    this.prev();
                    e.preventDefault();
                    break;
            }
        });
    }
    // }}}

    // {{{ _registerResizeEvent
    _registerResizeEvent(): void {
        const timer = setTimeout(() => {}, 0);
        const bound = (() => {
            clearTimeout(timer);
            this._resizeTimer = setTimeout(() => {
                this._pageWidth = this._container.offsetWidth;
                this.show(this.currentPage, false);
            }, 200);
        }).bind(this);
        window.addEventListener('resize', bound);
    }
    // }}}

    // {{{ _registerPopStateEvent
    _registerPopStateEvent(): void {
        const self = this;
        window.addEventListener('popstate', () => {
            self._handlingPopState = true;
            let url = window.location.href.split('#')[0];

            if (typeof self._pagesByUrl[url] !== 'undefined') {
                self.show(self._pagesByUrl[url], true);
            } else {
                self.load(url);
            }
            requestAnimationFrame(() => {
                self._handlingPopState = false;
            });
        });
    }
    // }}}

    // {{{ _registerStateChangeCompleteEvent
    _registerStateChangeCompleteEvent(): void {
        const container = this._container;
        const handler = (e: Event): void => {
            const detail = (e as CustomEvent).detail as { url: string; page?: HtmlElementWithMagaziner };
            const { url, page } = detail || { url: '', page: undefined };

            const title = (page?.__magaziner?.title) || '';
            const meta = (page?.__magaziner?.meta) || [] as unknown as Array<{ name: string; content: string }>;
            const ldjson = (page?.__magaziner?.ldjson) || [] as unknown as NodeListOf<HTMLScriptElement>;
            const links = (page?.__magaziner?.links) || [] as unknown as NodeListOf<HTMLLinkElement>;

            if (title) {
                document.title = title;
                try {
                    const titleEl = (document.getElementsByTagName('title'))[0];
                    if (titleEl) (titleEl as HTMLElement).innerHTML = document.title.replace('<', '&lt;').replace('>', '&gt;').replace(' & ', ' &amp; ');
                } catch (err) { }
            }

            const head = document.head;
            if (meta.length > 0) {
                (head.querySelectorAll("meta[name], meta[property]")) as NodeListOf<HTMLMetaElement>;
                meta.forEach(m => {
                    const metaEl = (document.createElement('meta')) as HTMLMetaElement;
                    metaEl.setAttribute("name", m.name);
                    metaEl.setAttribute("content", m.content);
                    head.appendChild(metaEl);
                });
            }

            if (ldjson.length > 0) {
                (head.querySelectorAll("script[type='application/ld+json']")) as NodeListOf<HTMLScriptElement>;
                ldjson.forEach(s => {
                    const scriptEl = (document.createElement('script')) as HTMLScriptElement;
                    scriptEl.type = 'application/ld+json';
                    scriptEl.textContent = s.textContent;
                    head.appendChild(scriptEl);
                });
            }

            if (links.length > 0) {
                (head.querySelectorAll("link[rel='canonical'], link[rel='alternate'], link[rel='icon']")) as NodeListOf<HTMLLinkElement>;
                links.forEach(l => {
                    const linkEl = (document.createElement('link')) as HTMLLinkElement;
                    for (let i = 0; i < (l as Element).attributes.length; i++) {
                        const attr = (l as Element).attributes[i];
                        if (attr.name === 'class') continue;
                        linkEl.setAttribute(attr.name, attr.value);
                    }
                    head.appendChild(linkEl);
                });
            }

            if (page?.__magaziner?.classes) {
                document.querySelector('body')?.setAttribute('class', (page as HtmlElementWithMagaziner).__magaziner.classes);
            }

            this._initPageLinks();

            if (typeof window._paq !== 'undefined') {
                (window._paq as unknown[]).push(['deleteCustomDimension', 1]);
                (window._paq as unknown[]).push(['setCustomUrl', url]);
                (window._paq as unknown[]).push(['setDocumentTitle', title]);
                (window._paq as unknown[]).push(['trackPageView']);
            }
            if (typeof window._gaq !== 'undefined') {
                (window._gaq as unknown[]).push(['_trackPageview', url]);
            } else if (typeof window.ga !== 'undefined') {
                (window.ga as Function)('send', 'pageview');
            }
            if (typeof window.pintrk !== 'undefined') {
                (window.pintrk as Function)('track', 'pagevisit');
            }
            if (typeof window.dataLayer !== 'undefined') {
                (window.dataLayer as unknown[]).push({
                    'event': 'Pageview',
                    'pagePath': url,
                    'pageTitle': title,
                    'visitorType': 'visitor'
                });
            }
        };
        container.addEventListener('depage-magaziner:statechangecomplete', handler as EventListener);
    }
    // }}}

    // {{{ _triggerShowLoaded
    _triggerShowLoaded(url: string, page: HtmlElementWithMagaziner): void {
        if (url === window.location.href) {
            MagazineNavigator._dispatchEvent(this._container, 'statechangecomplete', { url, page });
            this._resetFocus();
        }
    }
    // }}}

    // {{{ _getPageByNumber
    _getPageByNumber(n: number): HtmlElementWithMagaziner | null {
        if (n === this.currentPage) return this._currentPage;
        if (n === this.currentPage - 1) return this._prevPage;
        if (n === this.currentPage + 1) return this._nextPage;
        return null;
    }
    // }}}

    // {{{ _schedulePagePreload
    _schedulePagePreload(): void {
        if (this.options.preloadPageTimeout < 0) return;

        const numPages = this._urlsByPages.length;

        this._preloadPageTimer = setTimeout(() => {
            this._preloadPageByNumber(this.currentPage + 1);
            this._preloadPageTimer = setTimeout(() => {
                this._preloadPageByNumber(this.currentPage - 1);
            }, this.options.preloadPageTimeout * 0.5);

            if (this.options.wrapAround && numPages > 2) {
                if (this.currentPage === 0) {
                    this._preloadPageByNumber(numPages - 1, 'wrapAround');
                } else if (this.currentPage === (numPages - 1)) {
                    this._preloadPageByNumber(0, 'wrapAround');
                }
            }
        }, this.options.preloadPageTimeout);
    }
    // }}}

    // {{{ _preloadPageByNumber
    _preloadPageByNumber(n: number, wrapHint?: string): void {
        if (n < 0 || n >= this._urlsByPages.length) return;
        const url = this._urlsByPages[n];
        if (typeof url === 'undefined') return;

        const page = this._getPageByNumber(n);
        if (page) {
            this._preloadPage(page, url);
            return;
        }

        if (this.options.wrapAround && wrapHint === 'wrapAround') {
            const numPages = this._urlsByPages.length;
            if (n === 0 && this.currentPage === (numPages - 1) && this._nextPage) {
                this._preloadPage(this._nextPage, url);
            } else if (n === (numPages - 1) && this.currentPage === 0 && this._prevPage) {
                this._preloadPage(this._prevPage, url);
            }
        }
    }
    // }}}

    // {{{ _preloadPage
    _preloadPage(page: HtmlElementWithMagaziner, url: string): void {
        if (!page) return;

        (page.__magaziner) = (page.__magaziner) || ({} as MagazineNodeData);
        if (page.__magaziner!.loaded !== undefined && page.__magaziner!.loaded) {
            this._triggerShowLoaded(url, page);
            return;
        }
        if (page.__magaziner!.loading) return;

        page.__magaziner!.loading = true;
        page.classList.add('loading');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

        let finalUrl = url;
        fetch(url, { signal: controller.signal })
            .then(response => {
                clearTimeout(timer);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                finalUrl = response.url;

                if (finalUrl !== url) {
                    if (!MagazineNavigator._isInternalUrl(finalUrl, this._rootUrl)) {
                        document.location.href = finalUrl;
                        return null;
                    }
                    this._history.replaceState(null, null, finalUrl);
                    if (typeof this._pagesByUrl[url] !== 'undefined') {
                        const pageIdx = this._pagesByUrl[finalUrl];
                        if (typeof pageIdx !== 'undefined') {
                            this._pagesByUrl[url] = pageIdx;
                        } else {
                            this._pagesByUrl[url] = this._urlsByPages.length;
                        }
                        const existingIdx = this._urlsByPages.indexOf(finalUrl);
                        if (existingIdx !== -1) {
                            this._urlsByPages[this._pagesByUrl[url]] = finalUrl;
                        } else {
                            this._urlsByPages[this._pagesByUrl[url]] = finalUrl;
                        }
                    }
                }

                return response.text();
            })
            .then(html => {
                const parsed = MagazineNavigator._parsePageContent(html, this._rootUrl);
                if (!parsed.contentHtml) {
                    document.location.href = finalUrl;
                    return;
                }

                page.innerHTML = parsed.contentHtml;

                page.classList.remove('loading');
                page.__magaziner!.loading = false;
                page.__magaziner!.loaded = true;
                page.__magaziner!.classes = parsed.classes;
                page.__magaziner!.title = parsed.title;
                page.__magaziner!.meta = parsed.meta;
                page.__magaziner!.ldjson = parsed.ldjson;
                page.__magaziner!.links = parsed.links;

                MagazineNavigator._dispatchEvent(this._container, 'loaded', { url: finalUrl, page });
                MagazineNavigator._dispatchEvent(this._container, 'show', { url: finalUrl, page });
                this._triggerShowLoaded(finalUrl, page);
            })
            .catch(() => {
                page.classList.remove('loading');
                page.__magaziner!.loading = false;
                page.__magaziner!.loaded = false;

                if (finalUrl === document.location.href) {
                    document.location.href = finalUrl;
                }
            });
    }
    // }}}

    // {{{ _getNewPage
    _getNewPage(): HtmlElementWithMagaziner {
        const page = (MagazineNavigator._createNode(this._pageHtml)) as HtmlElementWithMagaziner;
        page.__magaziner = {} as MagazineNodeData;
        page.__magaziner.loaded = false;
        page.__magaziner.loading = false;
        page.__magaziner.attached = false;
        return page;
    }
    // }}}

    // {{{ _attachPage
    _attachPage(page: HtmlElementWithMagaziner): void {
        if (!page) return;

        (page.__magaziner) = (page.__magaziner) || ({} as MagazineNodeData);

        if (page.__magaziner!.attached) return;

        page.__magaziner!.attached = true;
        this._container.appendChild(page);
        MagazineNavigator._dispatchEvent(this._container, 'attached', { page });
    }
    // }}}

    // {{{ _detachPage
    _detachPage(page: HtmlElementWithMagaziner): void {
        (page.__magaziner) = (page.__magaziner) || ({} as MagazineNodeData);

        if (!page.__magaziner!.attached) return;

        page.__magaziner!.attached = false;
        if (page.parentNode === this._container) {
            this._container.removeChild(page);
        }
        MagazineNavigator._dispatchEvent(this._container, 'detached', { page });
    }
    // }}}

    // {{{ _removePage
    _removePage(page?: HtmlElementWithMagaziner): void {
        if (!page) return;

        MagazineNavigator._dispatchEvent(this._container, 'removed', { page });

        if (page.parentNode) page.remove();
    }
    // }}}

    // {{{ _offsetPages
    _offsetPages(x: number, adjustYOffset?: boolean): void {
        this._attachPage(this._currentPage);

        if (x > 0) {
            this._attachPage(this._prevPage);
        } else if (x < 0) {
            this._attachPage(this._nextPage);
        } else if (x === 0 && !this._container.classList.contains('animated')) {
            this._detachPage(this._prevPage);
            this._detachPage(this._nextPage);
        }

        this._setPageOffset(this._prevPage, -1 * this._pageWidth + x, this._scrollY, adjustYOffset);
        this._setPageOffset(this._currentPage, x, 0);
        this._setPageOffset(this._nextPage, 1 * this._pageWidth + x, this._scrollY, adjustYOffset);
    }
    // }}}

    // {{{ _setPageOffset
    _setPageOffset(page: HtmlElementWithMagaziner | null, x: number, y: number, adjustYOffset?: boolean): void {
        if (!page) return;
        if (typeof adjustYOffset === 'undefined') adjustYOffset = true;
        this._setPageXOffset(page, x);
        if (adjustYOffset) this._setPageYOffset(page, y);
    }
    // }}}

    // {{{ _setPageXOffset
    _setPageXOffset(page: HtmlElementWithMagaziner, x: number): void {
        page.style.setProperty('--pageTranslateX', x + 'px');
    }
    // }}}

    // {{{ _setPageYOffset
    _setPageYOffset(page: HtmlElementWithMagaziner, y: number): void {
        page.style.setProperty('--pageTranslateY', y + 'px');
    }
    // }}}

    // {{{ show
    show(n: number, animated: boolean = true, hash: string = ''): void {
        if (!this.options.touchNavigation && !this.options.keyboardNavigation) {
            animated = false;
        }

        const isNewPage = this.currentPage !== n;
        const posDiff = n - this.currentPage;
        const pageWidth = this._container.offsetWidth;

        this._container.classList.toggle('animated', animated);

        if (isNewPage) {
            this._pageWidth = pageWidth;
            const numPages = this._urlsByPages.length;
            if (this.options.wrapAround && posDiff === -(numPages - 1)) {
                this._removePage(this._prevPage);

                this._prevPage = this._currentPage;
                this._currentPage = this._nextPage;
                this._nextPage = this._getNewPage();
            } else if (this.options.wrapAround && posDiff === (numPages - 1)) {
                this._removePage(this._nextPage);

                this._nextPage = this._currentPage;
                this._currentPage = this._prevPage;
                this._prevPage = this._getNewPage();
            } else if (posDiff === 1) {
                this._removePage(this._prevPage);

                this._prevPage = this._currentPage;
                this._currentPage = this._nextPage;
                this._nextPage = this._getNewPage();
            } else if (posDiff === -1) {
                this._removePage(this._nextPage);

                this._nextPage = this._currentPage;
                this._currentPage = this._prevPage;
                this._prevPage = this._getNewPage();
            } else {
                this._removePage(this._prevPage);
                this._removePage(this._currentPage);
                this._removePage(this._nextPage);

                this._prevPage = this._getNewPage();
                this._nextPage = this._getNewPage();
                this._currentPage = this._getNewPage();
            }
        }
        this.currentPage = n;

        if (isNewPage && !this._handlingPopState && document.location.href.split('#')[0] !== this._urlsByPages[this.currentPage]) {
            this._history.pushState(null, null, this._urlsByPages[this.currentPage]);
        }

        this._preloadPageByNumber(n);
        this._attachPage(this._currentPage);

        if (isNewPage) {
            this._scrollY = window.scrollY;

            const oldCurrentPage = (this._container.querySelector('.current-page')) as HtmlElementWithMagaziner;
            const y = -1 * this._scrollY;

            if (oldCurrentPage) {
                oldCurrentPage.classList.remove('current-page');

                this._setPageYOffset(oldCurrentPage, y);
            }
            this._currentPage.classList.add('current-page');

            window.scrollTo(0, 0);
            this._scrollY = 0;

            MagazineNavigator._dispatchEvent(this._container, 'hide', { page: oldCurrentPage });
            MagazineNavigator._dispatchEvent(this._container, 'show', { url: this._urlsByPages[n], page: this._currentPage });
        }

        const self = this;
        const handler = (): void => {
            if (isNewPage) {
                self._schedulePagePreload();
            }
            self._detachPage(self._prevPage);
            self._detachPage(self._nextPage);
        };
        this._currentPage.removeEventListener("transitionend", handler);
        this._currentPage.addEventListener("transitionend", handler);

        this._offsetPages(0, false);

        if (hash !== '') {
            const currentPage = this._currentPage;
            const target = (currentPage as HtmlElementWithMagaziner)?.querySelector(hash) as HTMLElement | null;
            const scrollOptions = {
                behavior: 'smooth' as const,
                left: 0,
                top: 0
            };

            if (target) {
                this._scrollY = target.getBoundingClientRect().top + window.scrollY - this.options.scrollOffset;
                scrollOptions.top = this._scrollY;
            }

            if (this._scrollY === window.scrollY) {
                document.body.scroll();
            } else if (animated && MagazineNavigator._isSmoothScrollSupported) {
                window.scrollTo(scrollOptions);
            } else {
                window.scrollTo(scrollOptions.left, scrollOptions.top);
            }
            this._resetFocus(target);
        }
    }
    // }}}

    // {{{ load
    load(url: string): void {
        this._removePage(this._prevPage);
        this._removePage(this._currentPage);
        this._removePage(this._nextPage);

        this._prevPage = this._getNewPage();
        this._currentPage = this._getNewPage();
        this._nextPage = this._getNewPage();

        this._currentPage.classList.add('current-page');

        if (!this._handlingPopState) {
            this._history.pushState(null, null, url);
        }
        this._offsetPages(0);

        clearTimeout(this._preloadPageTimer);

        setTimeout(() => {
            this.currentPage = -1;
            this._preloadPage(this._currentPage, url);
        }, 50);
    }
    // }}}

    // {{{ next
    next(): void {
        if (this.currentPage < this._urlsByPages.length - 1 && this._nextEnabled) {
            this.show(this.currentPage + 1);
            MagazineNavigator._dispatchEvent(this._container, 'next');
        } else if (this.options.wrapAround && this._nextEnabled) {
            this.show(0);
            MagazineNavigator._dispatchEvent(this._container, 'next');
        } else {
            this._offsetPages(0);
        }
    }
    // }}}

    // {{{ prev
    prev(): void {
        if (this.currentPage > 0 && this._prevEnabled) {
            this.show(this.currentPage - 1);
            MagazineNavigator._dispatchEvent(this._container, 'prev');
        } else if (this.options.wrapAround && this._prevEnabled) {
            this.show(this._urlsByPages.length - 1);
            MagazineNavigator._dispatchEvent(this._container, 'prev');
        } else {
            this._offsetPages(0);
        }
    }
    // }}}

    // {{{ disablePrev
    disablePrev(): void {
        this._prevEnabled = false;
    }
    // }}}

    // {{{ disableNext
    disableNext(): void {
        this._nextEnabled = false;
    }
    // }}}

    // {{{ disable
    disable(): void {
        this._prevEnabled = false;
        this._nextEnabled = false;
    }
    // }}}

    // {{{ enablePrev
    enablePrev(): void {
        this._prevEnabled = true;
    }
    // }}}

    // {{{ enableNext
    enableNext(): void {
        this._nextEnabled = true;
    }
    // }}}

    // {{{ enable
    enable(): void {
        this._prevEnabled = true;
        this._nextEnabled = true;
    }
    // }}}

    // {{{ _resetFocus
    _resetFocus(targetElement: HTMLElement | null = document.body): void {
        if (!targetElement) return;
        const a = (document.createElement('a')) as HTMLAnchorElement;
        a.href = '#';
        a.style.position = 'absolute';
        a.style.width = '1px';
        a.style.height = '1px';
        a.style.overflow = 'hidden';
        a.innerHTML = 'reset focus';
        targetElement.prepend(a);
        a.focus();
        targetElement.removeChild(a);
    }
    // }}}
}

export { MagazineNavigator };

// vim:set ft=typescript sw=4 sts=4 fdm=marker :
