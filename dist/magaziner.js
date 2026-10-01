//#region src/magaziner.ts
var MagazineNavigator = class MagazineNavigator {
	static {
		this.defaultOptions = {
			scrollOffset: 0,
			preloadPageTimeout: 1e3,
			threshold: 30,
			keyboardNavigation: true,
			touchNavigation: true
		};
	}
	static {
		this._hasTouch = "ontouchstart" in window || "maxTouchPoints" in navigator && navigator.maxTouchPoints > 0;
	}
	static {
		this._isSmoothScrollSupported = "scrollBehavior" in document.documentElement.style;
	}
	static {
		this._downloadExtRegexp = /\.(pdf|zip|m4v|mp4|mp3|jpg|jpeg|png|webp|docx|pptx)$/i;
	}
	static _getRootUrl(container) {
		const baseUrl = document.querySelector("head base")?.getAttribute("href") || false;
		if (baseUrl && typeof baseUrl === "string" && baseUrl.charAt(baseUrl.length - 1) !== "/") return baseUrl + "/";
		return baseUrl && typeof baseUrl === "string" ? baseUrl : window.location.origin + "/";
	}
	static _isInternalUrl(url, rootUrl) {
		if (this._downloadExtRegexp.test(url)) return false;
		const normalizedRoot = rootUrl;
		return url.substring(0, normalizedRoot.length) === normalizedRoot || url.indexOf(":") === -1;
	}
	static _makeAbsolute(rootUrl, base, relative) {
		if (typeof relative === "undefined") return relative;
		if (relative && relative.match(/^(https?:\/\/|\/|data:|mailto:|tel:|call:)/)) return relative;
		if (rootUrl) return (rootUrl.endsWith("/") ? rootUrl : rootUrl + "/") + relative;
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
	static _parsePageContent(htmlString, rootUrl) {
		const doc = new DOMParser().parseFromString(htmlString, "text/html");
		const body = doc.querySelector("body") || doc.body;
		const page = body.querySelector(".page") || body;
		const title = body.querySelector("title")?.textContent || doc.title;
		const metaTags = doc.querySelectorAll("meta[name], meta[property]");
		const ldjson = doc.querySelectorAll("script[type='application/ld+json']");
		const links = doc.querySelectorAll("link[rel='canonical'], link[rel='alternate'], link[rel='icon']");
		const bodyClasses = body.getAttribute("class") || "";
		const allLinks = body.querySelectorAll("a[href]");
		for (let i = 0; i < allLinks.length; i++) {
			const el = allLinks[i];
			const attr = el.getAttribute("href");
			el.setAttribute("href", this._makeAbsolute(rootUrl, document.location.href, attr || ""));
		}
		const allImgs = body.querySelectorAll("img");
		for (let i = 0; i < allImgs.length; i++) {
			const el = allImgs[i];
			const attr = el.getAttribute("src");
			if (attr) el.setAttribute("src", this._makeAbsolute(rootUrl, document.location.href, attr));
		}
		const allIframes = body.querySelectorAll("iframe");
		for (let i = 0; i < allIframes.length; i++) {
			const el = allIframes[i];
			const attr = el.getAttribute("src");
			if (attr) el.setAttribute("src", this._makeAbsolute(rootUrl, document.location.href, attr));
		}
		return {
			contentHtml: page.innerHTML,
			classes: bodyClasses,
			title,
			meta: Array.from(metaTags).map((m) => ({
				name: m.getAttribute("name") || m.getAttribute("property") || "",
				content: m.getAttribute("content") || ""
			})),
			ldjson,
			links,
			body
		};
	}
	static _createNode(htmlString) {
		const fragment = document.createRange().createContextualFragment(htmlString);
		return fragment.children[0] || fragment;
	}
	static _dispatchEvent(container, eventName, detail) {
		container.dispatchEvent(new CustomEvent(`depage-magaziner:${eventName}`, {
			detail: detail || {},
			bubbles: true,
			cancelable: true
		}));
	}
	constructor(container, pagelinkSelector, options) {
		if (!("PointerEvent" in window)) {
			console.warn("[depage-magaziner] Pointer Events not supported. Magazine navigation disabled.");
			return;
		}
		container.__magaziner = this;
		this._container = container;
		this._pagelinkSelector = pagelinkSelector;
		this.options = Object.assign({}, MagazineNavigator.defaultOptions, options || {});
		this.currentPage = -1;
		this._rootUrl = MagazineNavigator._getRootUrl(container);
		this._pagesByUrl = {};
		this._urlsByPages = [];
		this._pageHtml = "<div class=\"page\"></div>";
		this._resizeTimer = null;
		this._preloadPageTimer = null;
		this._scrollY = 0;
		this._history = window.history;
		this._currentPage = null;
		this._prevPage = null;
		this._nextPage = null;
		this._pageWidth = 0;
		this._moving = false;
		this._startX = 0;
		this._prevEnabled = true;
		this._nextEnabled = true;
		document.documentElement.classList.add(MagazineNavigator._hasTouch ? "has-touch" : "no-touch");
		this._initPageLinks();
		this._registerEvents();
		const currentPageEl = this._container.querySelector(".page.current-page") || this._container.querySelector(".page");
		if (currentPageEl) this._currentPage = currentPageEl;
		this._prevPage = this._getNewPage();
		this._nextPage = this._getNewPage();
		MagazineNavigator._dispatchEvent(this._container, "initialized");
		setTimeout(() => {
			this.show(this.currentPage);
			this._schedulePagePreload();
		}, 50);
	}
	_initPageLinks() {
		const pagelinks = document.querySelectorAll(this._pagelinkSelector);
		this._pagesByUrl = {};
		this._urlsByPages = [];
		for (let i = 0; i < pagelinks.length; i++) {
			let url = pagelinks[i].href;
			if (pagelinks[i].getAttribute("href") === "") url = document.location.href;
			url = url.replace(/#.*/, "");
			if (typeof this._pagesByUrl[url] === "undefined") {
				this._pagesByUrl[url] = this._urlsByPages.length;
				this._urlsByPages.push(url);
			}
		}
		const currentLocation = document.location.href.replace(/#.*/, "");
		if (typeof this._pagesByUrl[currentLocation] === "undefined") this.currentPage = -1;
		else this.currentPage = this._pagesByUrl[currentLocation];
	}
	_registerLinkClicks() {
		document.addEventListener("click", (e) => {
			const target = e.target.closest("a[href]");
			if (!target) return;
			if (target.classList.contains("no-ajaxy")) return;
			const href = target.getAttribute("href");
			if (typeof href === "undefined") return;
			if (!MagazineNavigator._isInternalUrl(href, this._rootUrl)) return;
			target.setAttribute("href", target.href);
			if (e.button === 2 || e.metaKey) return;
			target.blur();
			const urlPath = target.href.replace(/#.*/, "");
			const hash = target.hash;
			if (typeof this._pagesByUrl[urlPath] !== "undefined") this.show(this._pagesByUrl[urlPath], true, hash);
			else this.load(target.href);
			e.preventDefault();
		});
	}
	_registerEvents() {
		if (this.options.touchNavigation) this._registerPointerEvents();
		if (this.options.keyboardNavigation) this._registerKeyboardEvents();
		this._registerResizeEvent();
		this._registerPopStateEvent();
		this._registerStateChangeCompleteEvent();
		this._registerLinkClicks();
	}
	_registerPointerEvents() {
		const container = this._container;
		const options = this.options;
		container.addEventListener("touchstart", (e) => {
			if (e.pointerType === "mouse") return;
			if (this._urlsByPages.length <= 1) return;
			if (this._hasTextSelected()) return;
			this._startX = e.touches[0].clientX;
			this._moving = false;
			this._pointerStartTime = performance.now();
			container.style.userSelect = "none";
		}, { passive: true });
		container.addEventListener("touchmove", (e) => {
			if (e.pointerType === "mouse") return;
			if (this._urlsByPages.length <= 1) return;
			if (this._hasTextSelected()) return;
			let dx = e.changedTouches[0].clientX - this._startX;
			const threshold = options.threshold || 30;
			if (Math.abs(dx) > threshold) this._moving = true;
			if (!this._moving) return;
			if (dx > 0 && (this.currentPage === 0 || !this._prevEnabled)) dx = 0;
			else if (dx < 0 && (this.currentPage >= this._urlsByPages.length || !this._nextEnabled)) dx = 0;
			this._scrollY = window.scrollY;
			this._offsetPages(dx);
		}, { passive: true });
		container.addEventListener("touchend", (e) => {
			if (e.pointerType === "mouse") return;
			if (this._hasTextSelected()) {
				container.style.userSelect = "";
				return;
			}
			container.style.userSelect = "";
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
			if (this._nextEnabled && (dx < -minMovement || dx < 0 && velocity > .5)) this.next();
			else if (this._prevEnabled && (dx > minMovement || dx > 0 && velocity > .5)) this.prev();
			else this._offsetPages(0);
			this.enable();
		}, { passive: true });
	}
	_hasTextSelected() {
		const selection = window.getSelection();
		return !!(selection && selection.toString().length > 0);
	}
	_registerKeyboardEvents() {
		document.addEventListener("keydown", (e) => {
			if (document.activeElement?.matches("input, textarea, select")) return;
			const fullscreen = this._container.querySelector(".fullscreen");
			if (fullscreen && fullscreen.offsetWidth > 0) return;
			if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
			switch (e.key || String.fromCharCode(e.keyCode)) {
				case "ArrowRight":
				case "l":
					this.next();
					e.preventDefault();
					break;
				case "ArrowLeft":
				case "h":
					this.prev();
					e.preventDefault();
			}
		});
	}
	_registerResizeEvent() {
		const timer = setTimeout(() => {}, 0);
		const bound = (() => {
			clearTimeout(timer);
			this._resizeTimer = setTimeout(() => {
				this._pageWidth = this._container.offsetWidth;
				this.show(this.currentPage, false);
			}, 200);
		}).bind(this);
		window.addEventListener("resize", bound);
	}
	_registerPopStateEvent() {
		const self = this;
		window.addEventListener("popstate", () => {
			self._handlingPopState = true;
			let url = window.location.href.split("#")[0];
			if (typeof self._pagesByUrl[url] !== "undefined") self.show(self._pagesByUrl[url], true);
			else self.load(url);
			requestAnimationFrame(() => {
				self._handlingPopState = false;
			});
		});
	}
	_registerStateChangeCompleteEvent() {
		const container = this._container;
		const handler = (e) => {
			const { url, page } = e.detail || {
				url: "",
				page: void 0
			};
			const title = page?.__magaziner?.title || "";
			const meta = page?.__magaziner?.meta || [];
			const ldjson = page?.__magaziner?.ldjson || [];
			const links = page?.__magaziner?.links || [];
			if (title) {
				document.title = title;
				try {
					const titleEl = document.getElementsByTagName("title")[0];
					if (titleEl) titleEl.innerHTML = document.title.replace("<", "&lt;").replace(">", "&gt;").replace(" & ", " &amp; ");
				} catch (err) {}
			}
			const head = document.head;
			if (meta.length > 0) {
				head.querySelectorAll("meta[name], meta[property]");
				meta.forEach((m) => {
					const metaEl = document.createElement("meta");
					metaEl.setAttribute("name", m.name);
					metaEl.setAttribute("content", m.content);
					head.appendChild(metaEl);
				});
			}
			if (ldjson.length > 0) {
				head.querySelectorAll("script[type='application/ld+json']");
				ldjson.forEach((s) => {
					const scriptEl = document.createElement("script");
					scriptEl.type = "application/ld+json";
					scriptEl.textContent = s.textContent;
					head.appendChild(scriptEl);
				});
			}
			if (links.length > 0) {
				head.querySelectorAll("link[rel='canonical'], link[rel='alternate'], link[rel='icon']");
				links.forEach((l) => {
					const linkEl = document.createElement("link");
					for (let i = 0; i < l.attributes.length; i++) {
						const attr = l.attributes[i];
						if (attr.name === "class") continue;
						linkEl.setAttribute(attr.name, attr.value);
					}
					head.appendChild(linkEl);
				});
			}
			if (page?.__magaziner?.classes) document.querySelector("body")?.setAttribute("class", page.__magaziner.classes);
			this._initPageLinks();
			if (typeof window._paq !== "undefined") {
				window._paq.push(["deleteCustomDimension", 1]);
				window._paq.push(["setCustomUrl", url]);
				window._paq.push(["setDocumentTitle", title]);
				window._paq.push(["trackPageView"]);
			}
			if (typeof window._gaq !== "undefined") window._gaq.push(["_trackPageview", url]);
			else if (typeof window.ga !== "undefined") window.ga("send", "pageview");
			if (typeof window.pintrk !== "undefined") window.pintrk("track", "pagevisit");
			if (typeof window.dataLayer !== "undefined") window.dataLayer.push({
				"event": "Pageview",
				"pagePath": url,
				"pageTitle": title,
				"visitorType": "visitor"
			});
		};
		container.addEventListener("depage-magaziner:statechangecomplete", handler);
	}
	_triggerShowLoaded(url, page) {
		if (url === window.location.href) {
			MagazineNavigator._dispatchEvent(this._container, "statechangecomplete", {
				url,
				page
			});
			this._resetFocus();
		}
	}
	_getPageByNumber(n) {
		if (n === this.currentPage) return this._currentPage;
		if (n === this.currentPage - 1) return this._prevPage;
		if (n === this.currentPage + 1) return this._nextPage;
		return null;
	}
	_schedulePagePreload() {
		if (this.options.preloadPageTimeout < 0) return;
		this._preloadPageTimer = setTimeout(() => {
			this._preloadPageByNumber(this.currentPage + 1);
			this._preloadPageTimer = setTimeout(() => {
				this._preloadPageByNumber(this.currentPage - 1);
			}, this.options.preloadPageTimeout);
		}, this.options.preloadPageTimeout);
	}
	_preloadPageByNumber(n) {
		if (n < 0 || n >= this._urlsByPages.length) return;
		const url = this._urlsByPages[n];
		if (typeof url === "undefined") return;
		const page = this._getPageByNumber(n);
		if (page) this._preloadPage(page, url);
	}
	_preloadPage(page, url) {
		if (!page) return;
		page.__magaziner = page.__magaziner || {};
		if (page.__magaziner.loaded !== void 0 && page.__magaziner.loaded) {
			this._triggerShowLoaded(url, page);
			return;
		}
		if (page.__magaziner.loading) return;
		page.__magaziner.loading = true;
		page.classList.add("loading");
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 5e3);
		let finalUrl = url;
		fetch(url, { signal: controller.signal }).then((response) => {
			clearTimeout(timer);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			finalUrl = response.url;
			if (finalUrl !== url) {
				if (!MagazineNavigator._isInternalUrl(finalUrl, this._rootUrl)) {
					document.location.href = finalUrl;
					return null;
				}
				this._history.replaceState(null, null, finalUrl);
				if (typeof this._pagesByUrl[url] !== "undefined") {
					const pageIdx = this._pagesByUrl[finalUrl];
					if (typeof pageIdx !== "undefined") this._pagesByUrl[url] = pageIdx;
					else this._pagesByUrl[url] = this._urlsByPages.length;
					if (this._urlsByPages.indexOf(finalUrl) !== -1) this._urlsByPages[this._pagesByUrl[url]] = finalUrl;
					else this._urlsByPages[this._pagesByUrl[url]] = finalUrl;
				}
			}
			return response.text();
		}).then((html) => {
			const parsed = MagazineNavigator._parsePageContent(html, this._rootUrl);
			if (!parsed.contentHtml) {
				document.location.href = finalUrl;
				return;
			}
			page.innerHTML = parsed.contentHtml;
			page.classList.remove("loading");
			page.__magaziner.loading = false;
			page.__magaziner.loaded = true;
			page.__magaziner.classes = parsed.classes;
			page.__magaziner.title = parsed.title;
			page.__magaziner.meta = parsed.meta;
			page.__magaziner.ldjson = parsed.ldjson;
			page.__magaziner.links = parsed.links;
			MagazineNavigator._dispatchEvent(this._container, "loaded", {
				url: finalUrl,
				page
			});
			MagazineNavigator._dispatchEvent(this._container, "show", {
				url: finalUrl,
				page
			});
			this._triggerShowLoaded(finalUrl, page);
		}).catch(() => {
			page.classList.remove("loading");
			page.__magaziner.loading = false;
			page.__magaziner.loaded = false;
			if (finalUrl === document.location.href) document.location.href = finalUrl;
		});
	}
	_getNewPage() {
		const page = MagazineNavigator._createNode(this._pageHtml);
		page.__magaziner = {};
		page.__magaziner.loaded = false;
		page.__magaziner.loading = false;
		page.__magaziner.attached = false;
		return page;
	}
	_attachPage(page) {
		if (!page) return;
		page.__magaziner = page.__magaziner || {};
		if (page.__magaziner.attached) return;
		page.__magaziner.attached = true;
		this._container.appendChild(page);
		MagazineNavigator._dispatchEvent(this._container, "attached", { page });
	}
	_detachPage(page) {
		page.__magaziner = page.__magaziner || {};
		if (!page.__magaziner.attached) return;
		page.__magaziner.attached = false;
		this._container.removeChild(page);
		MagazineNavigator._dispatchEvent(this._container, "detached", { page });
	}
	_removePage(page) {
		MagazineNavigator._dispatchEvent(this._container, "removed", { page });
		if (page && page.parentNode) page.remove();
	}
	_offsetPages(x, adjustYOffset) {
		this._attachPage(this._currentPage);
		if (x > -1 * this._pageWidth && x !== 0) this._attachPage(this._prevPage);
		if (x < 1 * this._pageWidth && x !== 0) this._attachPage(this._nextPage);
		if (x === 0 && !this._container.classList.contains("animated")) {
			this._detachPage(this._prevPage);
			this._detachPage(this._nextPage);
		}
		this._setPageOffset(this._prevPage, -1 * this._pageWidth + x, this._scrollY, adjustYOffset);
		this._setPageOffset(this._currentPage, x, 0);
		this._setPageOffset(this._nextPage, 1 * this._pageWidth + x, this._scrollY, adjustYOffset);
	}
	_setPageOffset(page, x, y, adjustYOffset) {
		if (!page) return;
		if (typeof adjustYOffset === "undefined") adjustYOffset = true;
		this._setPageXOffset(page, x);
		if (adjustYOffset) this._setPageYOffset(page, y);
	}
	_setPageXOffset(page, x) {
		page.style.setProperty("--pageTranslateX", x + "px");
	}
	_setPageYOffset(page, y) {
		page.style.setProperty("--pageTranslateY", y + "px");
	}
	show(n, animated = true, hash = "") {
		if (!this.options.touchNavigation && !this.options.keyboardNavigation) animated = false;
		const isNewPage = this.currentPage !== n;
		const posDiff = n - this.currentPage;
		const pageWidth = this._container.offsetWidth;
		if (isNewPage) {
			this._pageWidth = pageWidth;
			if (posDiff > 1 || posDiff < -1) {
				this._removePage(this._prevPage);
				this._removePage(this._currentPage);
				this._removePage(this._nextPage);
				this._prevPage = this._getNewPage();
				this._currentPage = this._getNewPage();
				this._nextPage = this._getNewPage();
			} else if (posDiff === 1) {
				this._removePage(this._prevPage);
				this._prevPage = this._currentPage;
				this._currentPage = this._nextPage;
				this._nextPage = this._getNewPage();
				this._attachPage(this._currentPage);
			} else if (posDiff === -1) {
				this._removePage(this._nextPage);
				this._nextPage = this._currentPage;
				this._currentPage = this._prevPage;
				this._prevPage = this._getNewPage();
				this._attachPage(this._currentPage);
			}
		}
		this._container.classList.toggle("animated", animated);
		this.currentPage = n;
		if (isNewPage && !this._handlingPopState && document.location.href.split("#")[0] !== this._urlsByPages[this.currentPage]) this._history.pushState(null, null, this._urlsByPages[this.currentPage]);
		this._preloadPageByNumber(n);
		this._attachPage(this._currentPage);
		if (isNewPage) {
			this._scrollY = window.scrollY;
			const oldCurrentPage = this._container.querySelector(".current-page");
			const y = -1 * this._scrollY;
			if (oldCurrentPage) {
				oldCurrentPage.classList.remove("current-page");
				this._setPageYOffset(oldCurrentPage, y);
			}
			this._currentPage.classList.add("current-page");
			window.scrollTo(0, 0);
			this._scrollY = 0;
			MagazineNavigator._dispatchEvent(this._container, "hide", { page: oldCurrentPage });
			MagazineNavigator._dispatchEvent(this._container, "show", {
				url: this._urlsByPages[n],
				page: this._currentPage
			});
		}
		const self = this;
		const handler = () => {
			if (isNewPage) self._schedulePagePreload();
			self._detachPage(self._prevPage);
			self._detachPage(self._nextPage);
			self._container.classList.remove("animated");
			self._currentPage?.removeEventListener("transitionend", handler);
		};
		this._currentPage?.addEventListener("transitionend", handler);
		this._offsetPages(0, false);
		if (hash !== "") {
			const target = this._currentPage?.querySelector(hash);
			const scrollOptions = {
				behavior: "smooth",
				left: 0,
				top: 0
			};
			if (target) {
				this._scrollY = target.getBoundingClientRect().top + window.scrollY - this.options.scrollOffset;
				scrollOptions.top = this._scrollY;
			}
			if (this._scrollY === window.scrollY) document.body.scroll();
			else if (animated && MagazineNavigator._isSmoothScrollSupported) window.scrollTo(scrollOptions);
			else window.scrollTo(scrollOptions.left, scrollOptions.top);
			this._resetFocus(target);
		}
	}
	load(url) {
		this._removePage(this._prevPage);
		this._removePage(this._currentPage);
		this._removePage(this._nextPage);
		this._prevPage = this._getNewPage();
		this._currentPage = this._getNewPage();
		this._currentPage.classList.add("current-page");
		this._nextPage = this._getNewPage();
		if (!this._handlingPopState) this._history.pushState(null, null, url);
		this._offsetPages(0);
		clearTimeout(this._preloadPageTimer);
		setTimeout(() => {
			this.currentPage = -1;
			this._preloadPage(this._currentPage, url);
		}, 50);
	}
	next() {
		if (this.currentPage < this._urlsByPages.length - 1 && this._nextEnabled) {
			this.show(this.currentPage + 1);
			MagazineNavigator._dispatchEvent(this._container, "next");
		} else this._offsetPages(0);
	}
	prev() {
		if (this.currentPage > 0 && this._prevEnabled) {
			this.show(this.currentPage - 1);
			MagazineNavigator._dispatchEvent(this._container, "prev");
		} else this._offsetPages(0);
	}
	disablePrev() {
		this._prevEnabled = false;
	}
	disableNext() {
		this._nextEnabled = false;
	}
	disable() {
		this._prevEnabled = false;
		this._nextEnabled = false;
	}
	enablePrev() {
		this._prevEnabled = true;
	}
	enableNext() {
		this._nextEnabled = true;
	}
	enable() {
		this._prevEnabled = true;
		this._nextEnabled = true;
	}
	_resetFocus(targetElement = document.body) {
		if (!targetElement) return;
		const a = document.createElement("a");
		a.href = "#";
		a.style.position = "absolute";
		a.style.width = "1px";
		a.style.height = "1px";
		a.style.overflow = "hidden";
		a.innerHTML = "reset focus";
		targetElement.prepend(a);
		a.focus();
		targetElement.removeChild(a);
	}
};
//#endregion
export { MagazineNavigator };
