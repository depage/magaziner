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
/**
 * This class adds magazine-like side-to-side page navigation to a website.
 */
declare class MagazineNavigator {
    static defaultOptions: Readonly<MagazineOptions>;
    static readonly _hasTouch: boolean;
    static readonly _isSmoothScrollSupported: boolean;
    static readonly _downloadExtRegexp: RegExp;
    /**
     * This function returns the root URL from the base tag or window location.
     *
     * @param container Optional container element.
     * @returns string
     */
    static _getRootUrl(container?: HTMLElement): string;
    /**
     * This function checks if a URL is internal (not a download or external link).
     *
     * @param url The URL to check.
     * @param rootUrl The root URL.
     * @returns boolean
     */
    static _isInternalUrl(url: string, rootUrl: string): boolean;
    /**
     * This function converts a relative URL to an absolute URL.
     *
     * @param rootUrl The root URL or null.
     * @param base The base URL.
     * @param relative The relative URL.
     * @returns string
     */
    static _makeAbsolute(rootUrl: string | null, base: string, relative: string): string;
    /**
     * This function parses HTML string and extracts page content, metadata, and links.
     *
     * @param htmlString The HTML string to parse.
     * @param rootUrl The root URL for making links absolute.
     * @returns PageData
     */
    static _parsePageContent(htmlString: string, rootUrl: string): PageData;
    /**
     * This function creates an HTMLElement or DocumentFragment from an HTML string.
     *
     * @param htmlString The HTML string.
     * @returns HTMLElement or DocumentFragment
     */
    static _createNode(htmlString: string): HTMLElement | DocumentFragment;
    /**
     * This function dispatches a custom event on the container.
     *
     * @param container The HTMLElement to dispatch the event on.
     * @param eventName The event name.
     * @param detail Optional event detail.
     */
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
    /**
     * This function initializes the MagazineNavigator with a container and page links.
     * The page link selector is just to add a specific page order with previous and next
     * pages. Usually one would use this selector to match links in the main navigation or sidebar.
     * All internal links would be loaded with magaziner (independent of this selector),
     * if not specifically excluded with the "no-ajax" class:
     *
     * @param container The container element.
     * @param pagelinkSelector CSS selector for page links.
     * @param options Optional configuration overrides.
     */
    constructor(container: HTMLElement, pagelinkSelector: string, options?: Partial<MagazineOptions>);
    /**
     * This function scans the document for page links and builds the page index.
     */
    _initPageLinks(): void;
    /**
     * This function registers a click handler on the document to intercept page link clicks.
     */
    _registerLinkClicks(): void;
    /**
     * This function registers all navigation event handlers.
     */
    _registerEvents(): void;
    /**
     * This function registers touch/mouse pointer events for swiping navigation.
     */
    _registerPointerEvents(): void;
    /**
     * This function checks if the user has selected any text.
     *
     * @returns boolean
     */
    _hasTextSelected(): boolean;
    /**
     * This function registers keyboard event handlers for arrow key navigation.
     */
    _registerKeyboardEvents(): void;
    /**
     * This function registers a debounced resize handler to update page width.
     */
    _registerResizeEvent(): void;
    /**
     * This function registers a browser back/forward (popstate) event handler.
     */
    _registerPopStateEvent(): void;
    /**
     * This function registers a handler for state change completion to update page metadata.
     */
    _registerStateChangeCompleteEvent(): void;
    /**
     * This function triggers the statechangecomplete event and resets focus.
     *
     * @param url The current URL.
     * @param page The HTML element representing the page.
     */
    _triggerShowLoaded(url: string, page: HtmlElementWithMagaziner): void;
    /**
     * This function returns a page element by its page number.
     *
     * @param n The page number.
     * @returns HtmlElementWithMagaziner or null.
     */
    _getPageByNumber(n: number): HtmlElementWithMagaziner | null;
    /**
     * This function schedules preloading of adjacent pages.
     */
    _schedulePagePreload(): void;
    /**
     * This function preloads a page by its page number.
     *
     * @param n The page number.
     * @param wrapHint Optional hint for wrap-around behavior.
     */
    _preloadPageByNumber(n: number, wrapHint?: string): void;
    /**
     * This function fetches and preloads a page by its URL.
     *
     * @param page The HTML element representing the page.
     * @param url The URL to fetch.
     */
    _preloadPage(page: HtmlElementWithMagaziner, url: string): void;
    /**
     * This function creates a new empty page element.
     *
     * @returns HtmlElementWithMagaziner
     */
    _getNewPage(): HtmlElementWithMagaziner;
    /**
     * This function attaches a page element to the container.
     *
     * @param page The HTML element representing the page.
     */
    _attachPage(page: HtmlElementWithMagaziner): void;
    /**
     * This function detaches a page element from the container.
     *
     * @param page The HTML element representing the page.
     */
    _detachPage(page: HtmlElementWithMagaziner): void;
    /**
     * This function removes a page element from the container and dispatches a removed event.
     *
     * @param page The HTML element representing the page.
     */
    _removePage(page?: HtmlElementWithMagaziner): void;
    /**
     * This function offsets pages horizontally during navigation transitions.
     *
     * @param x The horizontal offset in pixels.
     * @param adjustYOffset Whether to adjust the vertical offset.
     */
    _offsetPages(x: number, adjustYOffset?: boolean): void;
    /**
     * This function sets the horizontal and vertical offset of a page element.
     *
     * @param page The HTML element representing the page, or null.
     * @param x The horizontal offset in pixels.
     * @param y The vertical offset in pixels.
     * @param adjustYOffset Whether to apply the vertical offset.
     */
    _setPageOffset(page: HtmlElementWithMagaziner | null, x: number, y: number, adjustYOffset?: boolean): void;
    /**
     * This function sets the CSS horizontal offset variable of a page element.
     *
     * @param page The HTML element representing the page.
     * @param x The horizontal offset in pixels.
     */
    _setPageXOffset(page: HtmlElementWithMagaziner, x: number): void;
    /**
     * This function sets the CSS vertical offset variable of a page element.
     *
     * @param page The HTML element representing the page.
     * @param y The vertical offset in pixels.
     */
    _setPageYOffset(page: HtmlElementWithMagaziner, y: number): void;
    /**
     * This function shows a page by its page number with optional animation.
     *
     * @param n The page number.
     * @param animated Whether to animate the transition.
     * @param hash Optional hash fragment to scroll to.
     */
    show(n: number, animated?: boolean, hash?: string): void;
    /**
     * This function loads a new page by URL, clearing existing pages.
     *
     * @param url The URL to load.
     */
    load(url: string): void;
    /**
     * This function navigates to the next page.
     */
    next(): void;
    /**
     * This function navigates to the previous page.
     */
    prev(): void;
    /**
     * This function disables previous page navigation.
     */
    disablePrev(): void;
    /**
     * This function disables next page navigation.
     */
    disableNext(): void;
    /**
     * This function disables all navigation (prev and next).
     */
    disable(): void;
    /**
     * This function enables previous page navigation.
     */
    enablePrev(): void;
    /**
     * This function enables next page navigation.
     */
    enableNext(): void;
    /**
     * This function enables all navigation (prev and next).
     */
    enable(): void;
    /**
     * This function resets this current focus of the page.
     *
     * @param targetElement The element to focus, defaults to document.body.
     */
    _resetFocus(targetElement?: HTMLElement | null): void;
}
export { MagazineNavigator };
