/**
 * Minimal browser environment for the render smoke test. Imported first so the
 * global `window`/`document`/`localStorage` exist before any app module runs.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://anystream.test/',
  pretendToBeVisual: true,
});

const { window } = dom;

Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'localStorage', {
  value: window.localStorage,
  configurable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, configurable: true });
Object.defineProperty(globalThis, 'Node', { value: window.Node, configurable: true });
Object.defineProperty(globalThis, 'Event', { value: window.Event, configurable: true });
Object.defineProperty(globalThis, 'MouseEvent', { value: window.MouseEvent, configurable: true });

window.scrollTo = () => undefined;
window.HTMLElement.prototype.scrollIntoView = () => undefined;
window.HTMLElement.prototype.scrollBy = () => undefined;

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

export { window };
