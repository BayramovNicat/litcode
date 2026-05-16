import { JSDOM } from 'jsdom';
import { performance } from 'node:perf_hooks';
import { html as lcHtml, mount as lcMount, repeat as lcRepeat, type View } from '../src/lib';

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

const { html: litHtml, render: litRender } = await import('lit-html');
const { repeat: litRepeat } = await import('lit-html/directives/repeat.js');

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

const samples = 5;

function setupDom(): HTMLElement {
  dom.window.document.body.innerHTML = '<div id="app"></div>';
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
    `${result.name.padEnd(36)} avg ${avg.toFixed(4)}ms  med ${med.toFixed(4)}ms  min ${min.toFixed(4)}ms  max ${max.toFixed(4)}ms`,
  );
}

function lcRepeatedListView(items: number[]): View {
  return lcHtml`<ul>${lcRepeat(items, (item) => item, (item) => lcHtml`<li>Item ${item}</li>`)}</ul>`;
}

function litRepeatedListView(items: number[]) {
  return litHtml`<ul>${litRepeat(items, (item) => item, (item) => litHtml`<li>Item ${item}</li>`)}</ul>`;
}

function lcUnkeyedListView(offset: number): View {
  return lcHtml`<ul>${Array.from({ length: 1_000 }, (_, index) => lcHtml`<li>Item ${index + offset}</li>`)}</ul>`;
}

function litUnkeyedListView(offset: number) {
  return litHtml`<ul>${Array.from({ length: 1_000 }, (_, index) => litHtml`<li>Item ${index + offset}</li>`)}</ul>`;
}

const benches: Bench[] = [
  {
    name: 'litcode text update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const handle = lcMount(lcHtml`<button>Count ${count}</button>`, app);
      return () => handle.update(lcHtml`<button>Count ${++count}</button>`);
    },
  },
  {
    name: 'lit-html text update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let count = 0;
      litRender(litHtml`<button>Count ${count}</button>`, app);
      return () => litRender(litHtml`<button>Count ${++count}</button>`, app);
    },
  },
  {
    name: 'litcode attribute update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let active = false;
      const view = () => lcHtml`<button class=${active ? 'active' : 'idle'} data-state=${active ? 'on' : 'off'}>Go</button>`;
      const handle = lcMount(view(), app);
      return () => {
        active = !active;
        handle.update(view());
      };
    },
  },
  {
    name: 'lit-html attribute update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let active = false;
      const view = () => litHtml`<button class=${active ? 'active' : 'idle'} data-state=${active ? 'on' : 'off'}>Go</button>`;
      litRender(view(), app);
      return () => {
        active = !active;
        litRender(view(), app);
      };
    },
  },
  {
    name: 'litcode event handler update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const view = () => lcHtml`<button onclick=${() => count++}>${count}</button>`;
      const handle = lcMount(view(), app);
      return () => handle.update(view());
    },
  },
  {
    name: 'lit-html event handler update',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let count = 0;
      const view = () => litHtml`<button @click=${() => count++}>${count}</button>`;
      litRender(view(), app);
      return () => litRender(view(), app);
    },
  },
  {
    name: 'litcode controlled input',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let value = 'a';
      const handle = lcMount(lcHtml`<input value=${value} />`, app);
      return () => {
        value += 'b';
        handle.update(lcHtml`<input value=${value} />`);
      };
    },
  },
  {
    name: 'lit-html controlled input',
    iterations: 10_000,
    setup() {
      const app = setupDom();
      let value = 'a';
      litRender(litHtml`<input .value=${value} />`, app);
      return () => {
        value += 'b';
        litRender(litHtml`<input .value=${value} />`, app);
      };
    },
  },
  {
    name: 'litcode repeat rotate 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = lcMount(lcRepeatedListView(items), app);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        handle.update(lcRepeatedListView([...items.slice(offset), ...items.slice(0, offset)]));
      };
    },
  },
  {
    name: 'lit-html repeat rotate 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      litRender(litRepeatedListView(items), app);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        litRender(litRepeatedListView([...items.slice(offset), ...items.slice(0, offset)]), app);
      };
    },
  },
  {
    name: 'litcode unkeyed patch 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      let offset = 0;
      const handle = lcMount(lcUnkeyedListView(0), app);
      return () => {
        offset += 1_000;
        handle.update(lcUnkeyedListView(offset));
      };
    },
  },
  {
    name: 'lit-html unkeyed patch 1k',
    iterations: 50,
    warmup: 5,
    setup() {
      const app = setupDom();
      let offset = 0;
      litRender(litUnkeyedListView(0), app);
      return () => {
        offset += 1_000;
        litRender(litUnkeyedListView(offset), app);
      };
    },
  },
];

console.log(`litcode vs lit-html benchmarks (${samples} samples, ms/update)`);
for (const bench of benches) print(time(bench));
