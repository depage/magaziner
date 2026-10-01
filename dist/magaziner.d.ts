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
    meta: Array<{
        name: string;
        content: string;
    }>;
    ldjson: NodeListOf<HTMLScriptElement>;
    links: NodeListOf<HTMLLinkElement>;
    body: HTMLElement;
}
interface MagazineNodeData {
    loaded: boolean;
    loading: boolean;
    attached: boolean;
    title?: string;
    meta?: Array<{
        name: string;
        content: string;
    }>;
    classes?: string;
    ldjson?: NodeListOf<HTMLScriptElement>;
    links?: NodeListOf<HTMLLinkElement>;
}
type HtmlElementWithMagaziner = HTMLElement & {
    __magaziner?: MagazineNodeData;
};
declare class MagazineNavigator {
    static defaultOptions: Readonly<MagazineOptions>;
    static readonly _hasTouch: boolean;
    static readonly _isSmoothScrollSupported: boolean;
    static readonly _downloadExtRegexp: RegExp;
    static _getRootUrl(container?: HTMLElement): string;
    static _isInternalUrl(url: string, rootUrl: string): boolean;
    static _makeAbsolute(rootUrl: string | null, base: string, relative: string): string;
    static _parsePageContent(htmlString: string, rootUrl: string): PageData;
    static _createNode(htmlString: string): HTMLElement | DocumentFragment;
    static _dispatchEvent(container: HTMLElement, eventName: string, detail?: Record<string, unknown>): void;
    _container: HTMLElement;
    _pagelinkSelector: string;
    options: MagazineOptions;
    currentPage: number;
    _rootUrl: string;
    _pagesByUrl: Record<string, number>;
    _urlsByPages: string[];
    _pageHtml: string;
    _resizeTimer: ReturnType<typeof setTimeout> | null;
    _preloadPageTimer: ReturnType<typeof setTimeout> | null;
    _scrollY: number;
    _history: History;
    _currentPage: HtmlElementWithMagaziner | null;
    _prevPage: HtmlElementWithMagaziner;
    _nextPage: HtmlElementWithMagaziner;
    _pageWidth: number;
    _moving: boolean;
    _startX: number;
    _prevEnabled: boolean;
    _nextEnabled: boolean;
    _pointerStartTime: number;
    _handlingPopState: boolean;
    constructor(container: HTMLElement, pagelinkSelector: string, options?: Partial<MagazineOptions>);
    _initPageLinks(): void;
    _registerLinkClicks(): void;
    _registerEvents(): void;
    _registerPointerEvents(): void;
    _hasTextSelected(): boolean;
    _registerKeyboardEvents(): void;
    _registerResizeEvent(): void;
    _registerPopStateEvent(): void;
    _registerStateChangeCompleteEvent(): void;
    _triggerShowLoaded(url: string, page: HtmlElementWithMagaziner): void;
    _getPageByNumber(n: number): HtmlElementWithMagaziner | null;
    _schedulePagePreload(): void;
    _preloadPageByNumber(n: number): void;
    _preloadPage(page: HtmlElementWithMagaziner, url: string): void;
    _getNewPage(): HtmlElementWithMagaziner;
    _attachPage(page: HtmlElementWithMagaziner): void;
    _detachPage(page: HtmlElementWithMagaziner): void;
    _removePage(page: HtmlElementWithMagaziner): void;
    _offsetPages(x: number, adjustYOffset?: boolean): void;
    _setPageOffset(page: HtmlElementWithMagaziner | null, x: number, y: number, adjustYOffset?: boolean): void;
    _setPageXOffset(page: HtmlElementWithMagaziner, x: number): void;
    _setPageYOffset(page: HtmlElementWithMagaziner, y: number): void;
    show(n: number, animated?: boolean, hash?: string): void;
    load(url: string): void;
    next(): void;
    prev(): void;
    disablePrev(): void;
    disableNext(): void;
    disable(): void;
    enablePrev(): void;
    enableNext(): void;
    enable(): void;
    _resetFocus(targetElement?: HTMLElement | null): void;
}
export { MagazineNavigator };
