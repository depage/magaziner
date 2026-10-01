# @depage/magaziner

Magazine-style horizontal page navigation with touch, pointer, and keyboard support.

## Installation

```bash
bun install @depage/magaziner
```

or with npm:

```bash
npm install @depage/magaziner
```

## Usage

```javascript
import { MagazineNavigator } from '@depage/magaziner';
import '@depage/magaziner/magaziner.css';

const container = document.querySelector('#pagecontainer');
const nav = new MagazineNavigator(container, 'a[data-ajax]');
```

## HTML Structure

```html
<div id="pagecontainer">
  <a data-ajax href="/page1" class="page-link">Page 1</a>
  <a data-ajax href="/page2" class="page-link">Page 2</a>

  <div class="page current-page">
    <!-- current page content -->
  </div>
  <div class="page">
    <!-- next page content (loaded via fetch) -->
  </div>
</div>
```

## Options

```typescript
interface MagazineOptions {
  scrollOffset: number;      // Vertical scroll offset (default: 0)
  preloadPageTimeout: number; // Delay before preloading (default: 1000ms)
  threshold: number;         // Swipe threshold in px (default: 30)
  keyboardNavigation: boolean; // Enable keyboard nav (default: true)
  touchNavigation: boolean;    // Enable touch/swipe (default: true)
}
```

```javascript
const nav = new MagazineNavigator(container, 'a[data-ajax]', {
  scrollOffset: 50,
  threshold: 40,
  keyboardNavigation: true,
  touchNavigation: true
});
```

## API

### Constructor

```typescript
new MagazineNavigator(container: HTMLElement, pagelinkSelector: string, options?: Partial<MagazineOptions>)
```

### Public methods

| Method | Description |
|---|---|
| `show(n: number, animated?: boolean, hash?: string)` | Show page by index |
| `load(url: string)` | Load a new page via fetch |
| `next()` | Navigate to next page |
| `prev()` | Navigate to previous page |
| `disable()` | Disable navigation |
| `enable()` | Re-enable navigation |
| `disablePrev()` / `disableNext()` | Disable one direction |
| `enablePrev()` / `enableNext()` | Re-enable one direction |

### Events

Events fire on the container with the `depage-magaziner:` prefix:

| Event | Detail |
|---|---|
| `initialized` | Navigation ready |
| `show` | `{ url, page }` |
| `loaded` | `{ url, page }` — after fetch completes |
| `statechangecomplete` | `{ url, page }` — DOM updated |
| `hide` | `{ page }` |
| `attached` / `detached` / `removed` | `{ page }` |
| `next` / `prev` | Navigation events |

## Building

```bash
bun run build
```
