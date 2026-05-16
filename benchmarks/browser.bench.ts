import { component, html, mount, repeat, type View } from '../src/lib';

type Bench = {
  name: string;
  iterations: number;
  warmup?: number;
  setup(target: HTMLElement): () => void;
};

type BenchResult = {
  name: string;
  samples: number[];
};

declare global {
  interface Window {
    __litcodeBenchDone?: boolean;
    __litcodeBenchResults?: BenchResult[];
  }
}

const sampleCount = 5;
const app = document.querySelector<HTMLElement>('#app')!;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function resetTarget(): HTMLElement {
  app.replaceChildren();
  const target = document.createElement('div');
  app.appendChild(target);
  return target;
}

function runBench(bench: Bench): BenchResult {
  const samples: number[] = [];
  const warmup = bench.warmup ?? Math.min(100, bench.iterations);

  for (let sample = 0; sample < sampleCount + 1; sample++) {
    const target = resetTarget();
    const run = bench.setup(target);

    for (let index = 0; index < warmup; index++) run();

    const start = performance.now();
    for (let index = 0; index < bench.iterations; index++) run();
    const duration = performance.now() - start;

    if (sample > 0) samples.push(duration / bench.iterations);
  }

  return { name: bench.name, samples };
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

function repeatedListView(items: number[]): View {
  return html`<ul>${repeat(items, (item) => item, (item) => html`<li>Item ${item}</li>`)}</ul>`;
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
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const handle = mount(html`<button>Count ${count}</button>`, target);
      return () => handle.update(html`<button>Count ${++count}</button>`);
    },
  },
  {
    name: 'attribute update',
    iterations: 20_000,
    setup(target) {
      let active = false;
      const view = () => html`<button class=${active ? 'active' : 'idle'} data-state=${active ? 'on' : 'off'}>Go</button>`;
      const handle = mount(view(), target);
      return () => {
        active = !active;
        handle.update(view());
      };
    },
  },
  {
    name: 'event handler update',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () => html`<button onclick=${() => count++}>${count}</button>`;
      const handle = mount(view(), target);
      return () => handle.update(view());
    },
  },
  {
    name: 'controlled input',
    iterations: 20_000,
    setup(target) {
      let value = 'a';
      const handle = mount(html`<input value=${value} />`, target);
      return () => {
        value += 'b';
        handle.update(html`<input value=${value} />`);
      };
    },
  },
  {
    name: 'append/remove children',
    iterations: 2_000,
    setup(target) {
      let expanded = false;
      const view = () => html`<ul>${Array.from({ length: expanded ? 100 : 50 }, (_, index) => html`<li>${index}</li>`)}</ul>`;
      const handle = mount(view(), target);
      return () => {
        expanded = !expanded;
        handle.update(view());
      };
    },
  },
  {
    name: 'keyed reorder 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(keyedListView(items), target);
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
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(keyedListView(items), target);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        handle.update(keyedListView([...items.slice(offset), ...items.slice(0, offset)]));
      };
    },
  },
  {
    name: 'repeat rotate 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(repeatedListView(items), target);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        handle.update(repeatedListView([...items.slice(offset), ...items.slice(0, offset)]));
      };
    },
  },
  {
    name: 'repeat reverse 1k',
    iterations: 20,
    warmup: 3,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = mount(repeatedListView(items), target);
      const reversed = [...items].reverse();
      let flipped = false;
      return () => {
        flipped = !flipped;
        handle.update(repeatedListView(flipped ? reversed : items));
      };
    },
  },
  {
    name: 'keyed replace 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      let offset = 0;
      const view = () => keyedListView(Array.from({ length: 1_000 }, (_, index) => index + offset));
      const handle = mount(view(), target);
      return () => {
        offset += 1_000;
        handle.update(view());
      };
    },
  },
  {
    name: 'unkeyed patch 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      let offset = 0;
      const handle = mount(unkeyedListView(0), target);
      return () => {
        offset += 1_000;
        handle.update(unkeyedListView(offset));
      };
    },
  },
  {
    name: 'nested template parts',
    iterations: 2_000,
    setup(target) {
      let count = 0;
      const view = () => html`
        <main>
          <header><h1>${count}</h1></header>
          <section>${Array.from({ length: 100 }, (_, index) => html`<article><h2>${index}</h2><p>${count + index}</p></article>`)}</section>
        </main>
      `;
      const handle = mount(view(), target);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'component passthrough',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () => Passthrough({ children: html`<button>${count}</button>` });
      const handle = mount(view(), target);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'component root props',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () => RootProp({ className: count % 2 ? 'odd' : 'even', children: html`<button>${count}</button>` });
      const handle = mount(view(), target);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
];

console.log(`DOM browser benchmarks (${sampleCount} samples, ms/update)`);
window.__litcodeBenchResults = benches.map(runBench);
for (const result of window.__litcodeBenchResults) print(result);
window.__litcodeBenchDone = true;
