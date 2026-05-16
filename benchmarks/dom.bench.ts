import { JSDOM } from 'jsdom';
import { performance } from 'node:perf_hooks';
import { component, html, mount, type View } from '../src/lib';

type Bench = {
  name: string;
  iterations: number;
  warmup?: number;
  setup(): () => void;
};

type BenchResult = {
  name: string;
  iterations: number;
  samples: number[];
};

const samples = 3;

function setupDom(): HTMLElement {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    pretendToBeVisual: true,
  });

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
    Event: dom.window.Event,
  });

  return dom.window.document.querySelector<HTMLElement>('#app')!;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function time(bench: Bench): BenchResult {
  const measured: number[] = [];
  const warmup = bench.warmup ?? Math.min(100, bench.iterations);

  for (let sample = 0; sample < samples + 1; sample++) {
    const run = bench.setup();

    for (let index = 0; index < warmup; index++) run();

    const start = performance.now();
    for (let index = 0; index < bench.iterations; index++) run();
    const duration = performance.now() - start;

    if (sample > 0) measured.push(duration / bench.iterations);
  }

  return {
    name: bench.name,
    iterations: bench.iterations,
    samples: measured,
  };
}

function print(result: BenchResult): void {
  const avg = mean(result.samples);
  const med = median(result.samples);
  const min = Math.min(...result.samples);
  const max = Math.max(...result.samples);

  console.log(
    `${result.name.padEnd(32)} avg ${avg.toFixed(4)}ms  med ${med.toFixed(4)}ms  min ${min.toFixed(4)}ms  max ${max.toFixed(4)}ms`,
  );
}

function keyedListView(items: number[]): View {
  return html`<ul>${items.map((item) => html`<li key=${item}>Item ${item}</li>`)}</ul>`;
}

function unkeyedListView(offset: number): View {
  return html`<ul>${Array.from({ length: 1_000 }, (_, index) => html`<li>Item ${index + offset}</li>`)}</ul>`;
}

const Passthrough = component<{ children: View }>(({ children }) => html`<section>${children}</section>`);
const RootProp = component<{ className: string; children: View }>(
  ({ children }) => html`<section>${children}</section>`,
);

const benches: Bench[] = [
  {
    name: 'text update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const handle = mount(html`<button>Count ${count}</button>`, app);
      return () => handle.update(html`<button>Count ${++count}</button>`);
    },
  },
  {
    name: 'attribute update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let active = false;
      const view = () => html`<button class=${active ? 'active' : 'idle'} data-state=${active ? 'on' : 'off'}>Go</button>`;
      const handle = mount(view(), app);
      return () => {
        active = !active;
        handle.update(view());
      };
    },
  },
  {
    name: 'event handler update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const view = () => html`<button onclick=${() => count++}>${count}</button>`;
      const handle = mount(view(), app);
      return () => handle.update(view());
    },
  },
  {
    name: 'controlled input',
    iterations: 10_000,
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
    name: 'append/remove children',
    iterations: 1_000,
    setup() {
      const app = setupDom();
      let expanded = false;
      const view = () => html`<ul>${Array.from({ length: expanded ? 100 : 50 }, (_, index) => html`<li>${index}</li>`)}</ul>`;
      const handle = mount(view(), app);
      return () => {
        expanded = !expanded;
        handle.update(view());
      };
    },
  },
  {
    name: 'keyed reorder 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(keyedListView(items), app);
      const reversed = [...items].reverse();
      let flipped = false;
      return () => {
        flipped = !flipped;
        handle.update(keyedListView(flipped ? reversed : items));
      };
    },
  },
  {
    name: 'keyed rotate 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(keyedListView(items), app);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        handle.update(keyedListView([...items.slice(offset), ...items.slice(0, offset)]));
      };
    },
  },
  {
    name: 'keyed replace 1k',
    iterations: 25,
    warmup: 3,
    setup() {
      const app = setupDom();
      let offset = 0;
      const view = () => keyedListView(Array.from({ length: 1_000 }, (_, index) => index + offset));
      const handle = mount(view(), app);
      return () => {
        offset += 1_000;
        handle.update(view());
      };
    },
  },
  {
    name: 'unkeyed patch 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      let offset = 0;
      const handle = mount(unkeyedListView(0), app);
      return () => {
        offset += 1_000;
        handle.update(unkeyedListView(offset));
      };
    },
  },
  {
    name: 'nested template parts',
    iterations: 1_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const view = () => html`
        <main>
          <header><h1>${count}</h1></header>
          <section>${Array.from({ length: 100 }, (_, index) => html`<article><h2>${index}</h2><p>${count + index}</p></article>`)}</section>
        </main>
      `;
      const handle = mount(view(), app);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'component passthrough',
    iterations: 5_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const view = () => Passthrough({ children: html`<button>${count}</button>` });
      const handle = mount(view(), app);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'component root props',
    iterations: 5_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const view = () => RootProp({ className: count % 2 ? 'odd' : 'even', children: html`<button>${count}</button>` });
      const handle = mount(view(), app);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
];

console.log(`DOM patch benchmarks (${samples} samples, ms/update)`);
for (const bench of benches) print(time(bench));
