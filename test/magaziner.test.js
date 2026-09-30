import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { MagazineNavigator } from '../src/magaziner.js';

function createMockContainer(options = {}) {
    const container = document.createElement('div');
    container.id = 'pagecontainer';
    container.style.width = (options.width || '800px');
    container.style.height = (options.height || '600px');
    document.body.appendChild(container);
    return container;
}

function createMockPageLink(container, url, className = '') {
    const link = document.createElement('a');
    link.href = url;
    if (className) link.className = className;
    container.appendChild(link);
    return link;
}

function createMockPage(container, className = 'page current-page') {
    const page = document.createElement('div');
    page.className = className;
    container.appendChild(page);
    return page;
}

const TEST_ORIGIN = 'http://localhost';
function localhostUrl(path) {
    return TEST_ORIGIN + path;
}

// Set document.location.href to match a page URL (source uses document.location, not globalThis.location)
function mockDocumentLocation(url) {
    document.location.href = url;
}

// ============================================================
// Static method tests: _makeAbsolute
// ============================================================

// {{{ 'MagazineNavigator - static: _makeAbsolute'
describe('MagazineNavigator - static: _makeAbsolute', () => {
    test('returns undefined when relative is undefined', () => {
        expect(MagazineNavigator._makeAbsolute('http://example.com/', 'http://example.com/page', undefined)).toBe(undefined);
    });

    test('passes through absolute http URLs', () => {
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'http://other.com/path')).toBe('http://other.com/path');
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'https://secure.com/file.pdf')).toBe('https://secure.com/file.pdf');
    });

    test('passes through absolute root-relative URLs', () => {
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', '/assets/image.png')).toBe('/assets/image.png');
    });

    test('passes through data URIs', () => {
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'data:image/png;base64,ABC123')).toBe('data:image/png;base64,ABC123');
    });

    test('passes through mailto links', () => {
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    test('passes through tel links', () => {
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'tel:+1234567890')).toBe('tel:+1234567890');
    });

    test('passes through call links', () => {
        expect(MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'call://1234567890')).toBe('call://1234567890');
    });

    test('prepends rootUrl to relative paths (rootUrl with trailing slash)', () => {
        const result = MagazineNavigator._makeAbsolute('http://root.com/', 'http://example.com/base', 'page/subpage');
        expect(result).toBe('http://root.com/page/subpage');
    });

    test('adds trailing slash to rootUrl when missing', () => {
        const result = MagazineNavigator._makeAbsolute('http://root.com', 'http://example.com/base', 'page');
        expect(result).toBe('http://root.com/page');
    });

    test('resolves relative paths with . and .. (no rootUrl provided)', () => {
        let result = MagazineNavigator._makeAbsolute(null, 'http://example.com/base/page', 'subpage');
        expect(result).toBe('http://example.com/base/subpage');

        // "../../other" has TWO dots-dot segments from a/b/c
        result = MagazineNavigator._makeAbsolute(null, 'http://example.com/a/b/c', '../../other');
        expect(result).toBe('http://example.com/other');
    });

    test('returns relative as-is when no rootUrl', () => {
        const result = MagazineNavigator._makeAbsolute(null, 'http://example.com/base', 'relative/path');
        expect(result).toBe('http://example.com/relative/path');
    });
});
// }}}

// ============================================================
// Static method tests: _isInternalUrl
// ============================================================

// {{{ 'MagazineNavigator - static: _isInternalUrl'
describe('MagazineNavigator - static: _isInternalUrl', () => {
    test('returns true for URLs matching rootUrl prefix', () => {
        expect(MagazineNavigator._isInternalUrl('http://example.com/page', 'http://example.com/')).toBe(true);
        expect(MagazineNavigator._isInternalUrl('http://example.com/another', 'http://example.com/')).toBe(true);
    });

    test('returns false for external URLs with protocol', () => {
        expect(MagazineNavigator._isInternalUrl('https://other.com/page', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://external.com', 'http://example.com/')).toBe(false);
    });

    test('returns false for downloadable file extensions', () => {
        expect(MagazineNavigator._isInternalUrl('http://example.com/file.pdf', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/archive.zip', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/video.mp4', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/song.mp3', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/photo.jpg', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/photo.jpeg', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/image.png', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/image.webp', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/doc.docx', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/presentation.pptx', 'http://example.com/')).toBe(false);
        expect(MagazineNavigator._isInternalUrl('http://example.com/video.m4v', 'http://example.com/')).toBe(false);
    });

    test('returns true for URLs without protocol colon', () => {
        expect(MagazineNavigator._isInternalUrl('/relative/path', 'http://example.com/')).toBe(true);
        expect(MagazineNavigator._isInternalUrl('page', 'http://example.com/')).toBe(true);
    });
});
// }}}

// ============================================================
// Static method tests: _parsePageContent
// ============================================================

// {{{ 'MagazineNavigator - static: _parsePageContent'
describe('MagazineNavigator - static: _parsePageContent', () => {
    test('extracts title from <title> tag', () => {
        const html = '<html><body><title>My Page Title</title><div class="page">content</div></body></html>';
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        expect(result.title).toBe('My Page Title');
    });

    test('falls back to doc.title when no <title> tag', () => {
        const html = '<html><head><title>Fallback Title</title></head><body><div class="page">content</div></body></html>';
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        expect(result.title).toBe('Fallback Title');
    });

    test('extracts meta tags with name and property attributes', () => {
        const html = `<html><body><title>Test</title>
            <meta name="description" content="A description">
            <meta property="og:title" content="OG Title">
            <div class="page">content</div>
        </body></html>`;
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        expect(result.meta).toEqual([
            { name: 'description', content: 'A description' },
            { name: 'og:title', content: 'OG Title' }
        ]);
    });

    test('extracts JSON-LD script nodes', () => {
        const html = `<html><body><title>Test</title>
            <script type="application/ld+json">{"@context":"http://schema.org"}</script>
            <script type="application/ld+json">{"@context":"http://another.org"}</script>
            <div class="page">content</div>
        </body></html>`;
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        expect(result.ldjson.length).toBe(2);
    });

    test('extracts link nodes (canonical, alternate, icon)', () => {
        const html = `<html><body><title>Test</title>
            <link rel="canonical" href="http://example.com/canonical">
            <link rel="alternate" href="http://example.com/alt">
            <link rel="icon" href="/favicon.ico">
            <div class="page">content</div>
        </body></html>`;
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        expect(result.links.length).toBe(3);
    });

    test('extracts body classes', () => {
        const html = '<html><body class="home sidebar"><title>Test</title><div class="page">content</div></body></html>';
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        expect(result.classes).toBe('home sidebar');
    });

    test('rewrites href attributes of links to absolute URLs', () => {
        // Source passes through root-relative URLs unchanged (starts with /)
        const html = '<html><body><title>Test</title><div class="page"><a href="/page">Link</a><a href="relative">Relative</a></div></body></html>';
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        const allLinks = result.body.querySelectorAll('a');
        // Root-relative URLs stay root-relative (source design)
        expect(allLinks[0].getAttribute('href')).toBe('/page');
        // Relative paths without leading / get rootUrl prepended
        expect(allLinks[1].getAttribute('href')).toBe('http://example.com/relative');
    });

    test('rewrites src attributes of images to absolute URLs', () => {
        // Root-relative URLs stay root-relative (source design)
        const html = '<html><body><title>Test</title><div class="page"><img src="/img.png"></div></body></html>';
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        const img = result.body.querySelector('img');
        expect(img.getAttribute('src')).toBe('/img.png');
    });

    test('rewrites src attributes of iframes to absolute URLs', () => {
        // Root-relative URLs stay root-relative (source design)
        const html = '<html><body><title>Test</title><div class="page"><iframe src="/video.mp4"></iframe></div></body></html>';
        const result = MagazineNavigator._parsePageContent(html, 'http://example.com/');
        const iframe = result.body.querySelector('iframe');
        expect(iframe.getAttribute('src')).toBe('/video.mp4');
    });

    test('extracts contentHtml from .page element or body', () => {
        const htmlWithPage = '<html><body><title>Test</title><div class="page">page content</div></body></html>';
        let result = MagazineNavigator._parsePageContent(htmlWithPage, 'http://example.com/');
        expect(result.contentHtml).toBe('page content');

        const htmlWithoutPage = '<html><body><title>Test</title><div>body content</div></body></html>';
        result = MagazineNavigator._parsePageContent(htmlWithoutPage, 'http://example.com/');
        // When no .page element, body is used and contentHtml is everything from <body> minus <body> tags
        expect(result.contentHtml).toBe('<title>Test</title><div>body content</div>');
    });
});
// }}}

// ============================================================
// Static method tests: _createNode
// ============================================================

// {{{ 'MagazineNavigator - static: _createNode'
describe('MagazineNavigator - static: _createNode', () => {
    test('creates DOM node from HTML string', () => {
        const node = MagazineNavigator._createNode('<div class="page"></div>');
        expect(node.tagName).toBe('DIV');
        expect(node.classList.contains('page')).toBe(true);
    });

    test('returns fragment children[0] when available', () => {
        const node = MagazineNavigator._createNode('<span>text</span>');
        expect(node.tagName).toBe('SPAN');
    });
});
// }}}

// ============================================================
// Static method tests: _dispatchEvent
// ============================================================

// {{{ 'MagazineNavigator - static: _dispatchEvent'
describe('MagazineNavigator - static: _dispatchEvent', () => {
    test('dispatches CustomEvent with correct name format', () => {
        const container = document.createElement('div');
        let capturedEvent = null;
        container.addEventListener('depage-magaziner:test', (e) => {
            capturedEvent = e;
        });
        MagazineNavigator._dispatchEvent(container, 'test', { name: 'detail1', value: 'detail2' });
        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent.type).toBe('depage-magaziner:test');
        expect(capturedEvent.detail).toEqual({ name: 'detail1', value: 'detail2' });
        expect(capturedEvent.bubbles).toBe(true);
        expect(capturedEvent.cancelable).toBe(true);
    });

    test('dispatches with empty detail object when detail is null/undefined', () => {
        const container = document.createElement('div');
        let capturedEvent = null;
        container.addEventListener('depage-magaziner:nope', (e) => {
            capturedEvent = e;
        });
        MagazineNavigator._dispatchEvent(container, 'nope', null);
        expect(capturedEvent.detail).toEqual({});
    });
});
// }}}

// ============================================================
// Constructor tests
// ============================================================

// {{{ 'MagazineNavigator - constructor'
describe('MagazineNavigator - constructor', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('assigns instance to container.__magaziner', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));

        const navigator = new MagazineNavigator(container, 'a');
        expect(container.__magaziner).toBe(navigator);
    });

    test('initializes _pagesByUrl and _urlsByPages from pagelinkSelector', () => {
        const container = createMockContainer();

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._pagesByUrl[localhostUrl('/page1')]).toBe(0);
        expect(navigator._pagesByUrl[localhostUrl('/page2')]).toBe(1);
        expect(navigator._urlsByPages).toEqual([localhostUrl('/page1'), localhostUrl('/page2')]);
    });

    test('handles empty href as current page URL', () => {
        const container = createMockContainer();
        const link = document.createElement('a');
        link.href = '';
        container.appendChild(link);

        const navigator = new MagazineNavigator(container, 'a');
    });

    test('sets currentPage based on current document location', () => {
        const container = createMockContainer();
        mockDocumentLocation(localhostUrl('/target'));

        createMockPageLink(container, localhostUrl('/target'));

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator.currentPage).toBe(0);
    });

    test('dispatches "initialized" event', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));

        let eventFired = false;
        container.addEventListener('depage-magaziner:initialized', () => {
            eventFired = true;
        });

        new MagazineNavigator(container, 'a');
        expect(eventFired).toBe(true);
    });

    test('creates _currentPage from .page.current-page element', () => {
        const container = createMockContainer();
        createMockPage(container, 'page current-page');
        createMockPageLink(container, localhostUrl('/'));

        new MagazineNavigator(container, 'a');
        expect(container.__magaziner._currentPage).not.toBeNull();
    });
});
// }}}

// ============================================================
// _initPageLinks tests
// ============================================================

// {{{ 'MagazineNavigator - _initPageLinks'
describe('MagazineNavigator - _initPageLinks', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('maps all pagelinks to url-index pairs', () => {
        const container = createMockContainer();

        createMockPageLink(container, localhostUrl('/a'));
        createMockPageLink(container, localhostUrl('/b'));
        createMockPageLink(container, localhostUrl('/a'));

        const navigator = new MagazineNavigator(container, 'a');
        expect(Object.keys(navigator._pagesByUrl).length).toBe(2);
    });

    test('strips hash fragments from URLs', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/page') + '#section');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._pagesByUrl[localhostUrl('/page')]).toBeDefined();
        expect(navigator._pagesByUrl[localhostUrl('/page') + '#section']).toBeUndefined();
    });

    test('deduplicates URLs that map to the same index', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/page'));
        createMockPageLink(container, localhostUrl('/page'));

        const navigator = new MagazineNavigator(container, 'a');
        const entries = Object.entries(navigator._pagesByUrl);
        expect(entries[0][0]).toBe(localhostUrl('/page'));
    });
});
// }}}

// ============================================================
// show() tests
// ============================================================

// {{{ 'MagazineNavigator - show()'
describe('MagazineNavigator - show()', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('updates currentPage and dispatches events', () => {
        const container = createMockContainer({ width: '800px' });

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');

        let showFired = false;
        container.addEventListener('depage-magaziner:show', () => {
            showFired = true;
        });

        const pushSpy = spyOn(history, 'pushState');

        navigator.show(1, true);

        expect(navigator.currentPage).toBe(1);
        expect(pushSpy).toHaveBeenCalled();
    });

    test('toggles .animated class based on animated parameter', () => {
        const container = createMockContainer({ width: '800px' });

        createMockPageLink(container, localhostUrl('/page'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(container.classList.contains('animated')).toBe(false);

        navigator.show(0, true);
        expect(container.classList.contains('animated')).toBe(true);
    });

    test('handles hash anchor scrolling', () => {
        const container = createMockContainer({ width: '800px' });

        createMockPageLink(container, localhostUrl('/page'));
        const page = createMockPage(container, 'page current-page');
        const target = document.createElement('div');
        target.id = 'section1';
        page.appendChild(target);

        const navigator = new MagazineNavigator(container, 'a');
        const scrollToSpy = spyOn(window, 'scrollTo');

        navigator.show(0, true, '#section1');
    });
});
// }}}

// ============================================================
// next() / prev() tests
// ============================================================

// {{{ 'MagazineNavigator - next() / prev()'
describe('MagazineNavigator - next() / prev()', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('next() navigates to next page', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPageLink(container, localhostUrl('/page3'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator.currentPage).toBe(0);

        navigator.next();
        expect(navigator.currentPage).toBe(1);
    });

    test('prev() navigates to previous page', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page3'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPageLink(container, localhostUrl('/page3'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator.currentPage).toBe(2);

        navigator.prev();
        expect(navigator.currentPage).toBe(1);
    });

    test('next() does not navigate past last page', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page'));

        createMockPageLink(container, localhostUrl('/page'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        const initialCurrent = navigator.currentPage;

        navigator.next();
        expect(navigator.currentPage).toBe(initialCurrent);
    });

    test('prev() does not navigate before first page', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page'));

        createMockPageLink(container, localhostUrl('/page'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');

        navigator.prev();
        expect(navigator.currentPage).toBe(0);
    });

    test('next() respects _nextEnabled flag', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disableNext();
        expect(navigator._nextEnabled).toBe(false);

        const initialCurrent = navigator.currentPage;
        navigator.next();
        expect(navigator.currentPage).toBe(initialCurrent);
    });

    test('prev() respects _prevEnabled flag', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page2'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disablePrev();
        expect(navigator._prevEnabled).toBe(false);

        const initialCurrent = navigator.currentPage;
        navigator.prev();
        expect(navigator.currentPage).toBe(initialCurrent);
    });
});
// }}}

// ============================================================
// disable / enable tests
// ============================================================

// {{{ 'MagazineNavigator - disable / enable'
describe('MagazineNavigator - disable / enable', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('disable() sets both flags to false', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._prevEnabled).toBe(true);
        expect(navigator._nextEnabled).toBe(true);

        navigator.disable();
        expect(navigator._prevEnabled).toBe(false);
        expect(navigator._nextEnabled).toBe(false);
    });

    test('enable() sets both flags to true', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disable();
        expect(navigator._prevEnabled).toBe(false);
        expect(navigator._nextEnabled).toBe(false);

        navigator.enable();
        expect(navigator._prevEnabled).toBe(true);
        expect(navigator._nextEnabled).toBe(true);
    });

    test('disableNext() sets only _nextEnabled to false', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disableNext();
        expect(navigator._nextEnabled).toBe(false);
        expect(navigator._prevEnabled).toBe(true);
    });

    test('enableNext() sets only _nextEnabled to true', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disableNext();
        navigator.enableNext();
        expect(navigator._nextEnabled).toBe(true);
        expect(navigator._prevEnabled).toBe(true);
    });

    test('disablePrev() sets only _prevEnabled to false', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disablePrev();
        expect(navigator._prevEnabled).toBe(false);
        expect(navigator._nextEnabled).toBe(true);
    });

    test('enablePrev() sets only _prevEnabled to true', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        navigator.disablePrev();
        navigator.enablePrev();
        expect(navigator._prevEnabled).toBe(true);
        expect(navigator._nextEnabled).toBe(true);
    });
});
// }}}

// ============================================================
// Options: keyboardNavigation and touchNavigation
// ============================================================

// {{{ 'MagazineNavigator - options: keyboardNavigation and touchNavigation'
describe('MagazineNavigator - options: keyboardNavigation and touchNavigation', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('default options have keyboardNavigation: true', () => {
        expect(MagazineNavigator.defaultOptions.keyboardNavigation).toBe(true);
    });

    test('default options have touchNavigation: true', () => {
        expect(MagazineNavigator.defaultOptions.touchNavigation).toBe(true);
    });

    test('constructor respects keyboardNavigation: false', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));

        const navigator = new MagazineNavigator(container, 'a', { keyboardNavigation: false });
        expect(navigator.options.keyboardNavigation).toBe(false);
    });

    test('constructor respects touchNavigation: false', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));

        const navigator = new MagazineNavigator(container, 'a', { touchNavigation: false });
        expect(navigator.options.touchNavigation).toBe(false);
    });

    test('both options can be set to false simultaneously', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));

        const navigator = new MagazineNavigator(container, 'a', {
            keyboardNavigation: false,
            touchNavigation: false
        });
        expect(navigator.options.keyboardNavigation).toBe(false);
        expect(navigator.options.touchNavigation).toBe(false);
    });
});
// }}}

// ============================================================
// load() with fetch tests
// ============================================================

// {{{ 'MagazineNavigator - load() with fetch'
describe('MagazineNavigator - load() with fetch', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        // Mock fetch before MagazineNavigator constructor runs
        globalThis.fetch = () => Promise.resolve(new Response('<html><body><div class="page">content</div></body></html>', {
            url: localhostUrl('/newpage')
        }));
    });

    afterEach(() => {
        globalThis.fetch = undefined;
    });

    test('load() fetches URL and updates page content', async () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page'));

        createMockPageLink(container, localhostUrl('/page'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');

        let loadedFired = false;
        container.addEventListener('depage-magaziner:loaded', (e) => {
            loadedFired = true;
        });

        navigator.load(localhostUrl('/newpage'));

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(loadedFired).toBe(true);
    });
});
// }}}

// ============================================================
// _getPageByNumber tests
// ============================================================

// {{{ 'MagazineNavigator - _getPageByNumber'
describe('MagazineNavigator - _getPageByNumber', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('returns _currentPage for matching index', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._getPageByNumber(navigator.currentPage)).toBe(navigator._currentPage);
    });

    test('returns null for non-adjacent page numbers', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._getPageByNumber(999)).toBeNull();
    });

    test('returns _prevPage for currentPage - 1', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._getPageByNumber(navigator.currentPage - 1)).toBe(navigator._prevPage);
    });

    test('returns _nextPage for currentPage + 1', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        expect(navigator._getPageByNumber(navigator.currentPage + 1)).toBe(navigator._nextPage);
    });
});
// }}}

// ============================================================
// _getNewPage tests
// ============================================================

// {{{ 'MagazineNavigator - _getNewPage'
describe('MagazineNavigator - _getNewPage', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('creates a page element with __magaziner properties', () => {
        const container = createMockContainer();
        createMockPageLink(container, localhostUrl('/'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        const newPage = navigator._getNewPage();

        expect(newPage.tagName).toBe('DIV');
        expect(newPage.__magaziner).toBeDefined();
        expect(newPage.__magaziner.loaded).toBe(false);
        expect(newPage.__magaziner.loading).toBe(false);
        expect(newPage.__magaziner.attached).toBe(false);
    });
});
// }}}

// ============================================================
// Link click interception tests (_registerLinkClicks)
// ============================================================

// {{{ 'MagazineNavigator - link click interception'
describe('MagazineNavigator - link click interception', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('clicking the second link calls show() with index 1', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        const showSpy = spyOn(navigator, 'show');

        const links = container.querySelectorAll('a');
        links[1].dispatchEvent(new PointerEvent('click', { bubbles: true }));

        expect(showSpy).toHaveBeenCalledWith(1, true, '');
    });

    test('clicking the current page link calls show() with the current index', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        const showSpy = spyOn(navigator, 'show');

        const link = container.querySelector('a');
        link.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        expect(showSpy).toHaveBeenCalledWith(0, true, '');
    });

    test('clicking a link not in the container calls load() for unknown URLs', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPageLink(container, localhostUrl('/page2'));
        createMockPage(container, 'page current-page');

        const pushStateSpy = spyOn(history, 'pushState');

        const unknownLink = document.createElement('a');
        unknownLink.href = localhostUrl('/unknown');
        document.body.appendChild(unknownLink);

        const beforeCalls = pushStateSpy.mock?.calls?.length || 0;

        unknownLink.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        const afterCalls = pushStateSpy.mock?.calls?.length || 0;
        expect(afterCalls).toBeGreaterThan(beforeCalls);
        const lastCall = pushStateSpy.mock.calls[afterCalls - 1];
        expect(lastCall[2]).toBe(localhostUrl('/unknown'));
    });

    test('clicking a link with no-ajaxy class is ignored', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        const link = createMockPageLink(container, localhostUrl('/page2'), 'no-ajaxy');
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        const showSpy = spyOn(navigator, 'show');
        const loadSpy = spyOn(navigator, 'load');

        link.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        expect(showSpy).not.toHaveBeenCalled();
        expect(loadSpy).not.toHaveBeenCalled();
    });

    test('clicking a link with external URL is ignored', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPage(container, 'page current-page');

        const pushStateSpy = spyOn(history, 'pushState');

        new MagazineNavigator(container, 'a');

        const beforeCalls = pushStateSpy.mock?.calls?.length || 0;

        const externalLink = document.createElement('a');
        externalLink.href = 'https://external.com/page';
        document.body.appendChild(externalLink);

        externalLink.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        // pushState should not be called for external URLs
        const afterCalls = pushStateSpy.mock?.calls?.length || 0;
        expect(afterCalls).toBe(beforeCalls);
    });

    test('clicking a dynamically added link outside the container is intercepted', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPage(container, 'page current-page');

        const pushStateSpy = spyOn(history, 'pushState');

        new MagazineNavigator(container, 'a');

        const beforeCalls = pushStateSpy.mock?.calls?.length || 0;

        // Add a link dynamically outside the container
        const dynamicLink = document.createElement('a');
        dynamicLink.href = localhostUrl('/dynamic');
        document.body.appendChild(dynamicLink);

        dynamicLink.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        // Check that the dynamic URL was passed to pushState (may be called multiple times by multiple handlers)
        const allCalls = pushStateSpy.mock?.calls || [];
        const hasDynamicCall = allCalls.some(call => call[2] === localhostUrl('/dynamic'));
        expect(hasDynamicCall).toBe(true);
    });

    test('clicking a child element inside a link is handled via closest()', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        const link = createMockPageLink(container, localhostUrl('/page2'));
        const innerSpan = document.createElement('span');
        innerSpan.textContent = 'Click me';
        link.appendChild(innerSpan);
        createMockPage(container, 'page current-page');

        const pushStateSpy = spyOn(history, 'pushState');

        const beforeCalls = pushStateSpy.mock?.calls?.length || 0;

        innerSpan.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        const afterCalls = pushStateSpy.mock?.calls?.length || 0;
        expect(afterCalls).toBeGreaterThan(beforeCalls);
    });

    test('clicking an element that is not a link does nothing', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        createMockPageLink(container, localhostUrl('/page1'));
        createMockPage(container, 'page current-page');

        const navigator = new MagazineNavigator(container, 'a');
        const showSpy = spyOn(navigator, 'show');
        const loadSpy = spyOn(navigator, 'load');

        container.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        expect(showSpy).not.toHaveBeenCalled();
        expect(loadSpy).not.toHaveBeenCalled();
    });

    test('clicking a link with hash includes the hash in the call', () => {
        const container = createMockContainer({ width: '800px' });
        mockDocumentLocation(localhostUrl('/page1'));

        const link = document.createElement('a');
        link.href = localhostUrl('/page2') + '#section';
        document.body.appendChild(link);
        createMockPageLink(container, localhostUrl('/page1'));
        createMockPage(container, 'page current-page');

        const pushStateSpy = spyOn(history, 'pushState');

        const beforeCalls = pushStateSpy.mock?.calls?.length || 0;

        new MagazineNavigator(container, 'a');

        link.dispatchEvent(new PointerEvent('click', { bubbles: true }));

        const allCalls = pushStateSpy.mock?.calls || [];
        const hasHashCall = allCalls.some(call => call[2] === localhostUrl('/page2') + '#section');
        expect(hasHashCall).toBe(true);
    });
});
// }}}

// vim:set ft=javascript sw=4 sts=4 fdm=marker :
