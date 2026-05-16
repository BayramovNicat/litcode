import { JSDOM } from 'jsdom';
import { performance } from 'node:perf_hooks';
import { html, mount, type View } from '../src/lib';

type Bench = {
  name: string;
  iterations: number;
  setup(): () => void;
};

function setupDom(): HTMLElement {
  const dom = new JSDOM('<!doctype html><div id="app"></div>');

  Object.assign(globalThis, {
    document: dom.window.document,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLOptionElement: dom.window.HTMLOptionElement,
  });

  return dom.window.document.querySelector<HTMLElement>('#app')!;
}

function time(name: string, iterations: number, setup: () => () => void): void {
  const run = setup();
  const start = performance.now();
  for (let index = 0; index < iterations; index++) run();
  const duration = performance.now() - start;
  const perUpdate = duration / iterations;

  console.log(`${name.padEnd(28)} ${duration.toFixed(2)}ms total ${perUpdate.toFixed(4)}ms/update`);
}

function listView(items: number[]): View {
  return html`<ul>${items.map((item) => html`<li key=${item}>Item ${item}</li>`)}</ul>`;
}

const benches: Bench[] = [
  {
    name: 'text update',
    iterations: 5_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const handle = mount(html`<button>Count ${count}</button>`, app);
      return () => handle.update(html`<button>Count ${++count}</button>`);
    },
  },
  {
    name: 'controlled input',
    iterations: 5_000,
    setup() {
      const app = setupDom();
      let value = 'a';
      const handle = mount(html`<input value=${value} />`, app);
      return () => {
        value += 'b';
        handle.update(html`<input value=${value} />`);
      };
    },
  },
  {
    name: 'keyed reorder 1k',
    iterations: 200,
    setup() {
      const app = setupDom();
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(listView(items), app);
      const reversed = [...items].reverse();
      let flipped = false;
      return () => {
        flipped = !flipped;
        handle.update(listView(flipped ? reversed : items));
      };
    },
  },
  {
    name: 'unkeyed patch 1k',
    iterations: 200,
    setup() {
      const app = setupDom();
      let offset = 0;
      const view = (offset: number) =>
        html`<ul>${Array.from({ length: 1_000 }, (_, index) => html`<li>Item ${index + offset}</li>`)}</ul>`;
      const handle = mount(view(0), app);
      return () => {
        offset += 1_000;
        handle.update(view(offset));
      };
    },
  },
];

console.log('DOM patch benchmarks');
for (const bench of benches) time(bench.name, bench.iterations, bench.setup);
