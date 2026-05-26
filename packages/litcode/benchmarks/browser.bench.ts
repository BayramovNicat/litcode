import {
  component,
  html as lcHtml,
  mount as lcMount,
  repeat as lcRepeat,
  type View,
} from '../src/lib';
import { html as litHtml, render as litRender } from 'lit-html';
import { repeat as litRepeat } from 'lit-html/directives/repeat.js';

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
    `${result.name.padEnd(36)} avg ${avg.toFixed(4)}ms  med ${med.toFixed(4)}ms  min ${min.toFixed(4)}ms  max ${max.toFixed(4)}ms`,
  );
}

function lcKeyedListView(items: number[]): View {
  return lcHtml`<ul>
    ${items.map((item) => lcHtml`<li key="${item}">Item ${item}</li>`)}
  </ul>`;
}

function lcRepeatedListView(items: number[]): View {
  return lcHtml`<ul>
    ${lcRepeat(
      items,
      (item) => item,
      (item) => lcHtml`<li>Item ${item}</li>`,
    )}
  </ul>`;
}

function lcUnkeyedListView(offset: number): View {
  return lcHtml`<ul>
    ${Array.from({ length: 1_000 }, (_, index) => lcHtml`<li>Item ${index + offset}</li>`)}
  </ul>`;
}

function litRepeatedListView(items: number[]) {
  return litHtml`<ul>${litRepeat(
    items,
    (item) => item,
    (item) => litHtml`<li>Item ${item}</li>`,
  )}</ul>`;
}

function litUnkeyedListView(offset: number) {
  return litHtml`<ul>${Array.from({ length: 1_000 }, (_, index) => litHtml`<li>Item ${index + offset}</li>`)}</ul>`;
}

const Passthrough = component<{ children: View }>(
  ({ children }) => lcHtml`<section>${children}</section>`,
);
const RootProp = component<{ className: string; children: View }>(
  ({ children }) => lcHtml`<section>${children}</section>`,
);

const benches: Bench[] = [
  // 1. Text updates
  {
    name: 'litcode text update',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const handle = lcMount(lcHtml`<button>Count ${count}</button>`, target);
      return () => handle.update(lcHtml`<button>Count ${++count}</button>`);
    },
  },
  {
    name: 'lit-html text update',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      litRender(litHtml`<button>Count ${count}</button>`, target);
      return () => litRender(litHtml`<button>Count ${++count}</button>`, target);
    },
  },

  // 2. Attribute updates
  {
    name: 'litcode attribute update',
    iterations: 20_000,
    setup(target) {
      let active = false;
      const view = () =>
        lcHtml`<button class="${active ? 'active' : 'idle'}" data-state="${active ? 'on' : 'off'}">
          Go
        </button>`;
      const handle = lcMount(view(), target);
      return () => {
        active = !active;
        handle.update(view());
      };
    },
  },
  {
    name: 'lit-html attribute update',
    iterations: 20_000,
    setup(target) {
      let active = false;
      const view = () =>
        litHtml`<button class=${active ? 'active' : 'idle'} data-state=${active ? 'on' : 'off'}>
          Go
        </button>`;
      litRender(view(), target);
      return () => {
        active = !active;
        litRender(view(), target);
      };
    },
  },

  // 3. Event handler updates
  {
    name: 'litcode event handler update',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () => lcHtml`<button onclick="${() => count++}">${count}</button>`;
      const handle = lcMount(view(), target);
      return () => handle.update(view());
    },
  },
  {
    name: 'lit-html event handler update',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () => litHtml`<button @click=${() => count++}>${count}</button>`;
      litRender(view(), target);
      return () => litRender(view(), target);
    },
  },

  // 4. Controlled input updates
  {
    name: 'litcode controlled input',
    iterations: 20_000,
    setup(target) {
      let value = 'a';
      const handle = lcMount(lcHtml`<input value="${value}" />`, target);
      return () => {
        value += 'b';
        handle.update(lcHtml`<input value="${value}" />`);
      };
    },
  },
  {
    name: 'lit-html controlled input',
    iterations: 20_000,
    setup(target) {
      let value = 'a';
      litRender(litHtml`<input .value=${value} />`, target);
      return () => {
        value += 'b';
        litRender(litHtml`<input .value=${value} />`, target);
      };
    },
  },

  // 5. Repeat rotate 1k
  {
    name: 'litcode repeat rotate 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = lcMount(lcRepeatedListView(items), target);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        handle.update(lcRepeatedListView([...items.slice(offset), ...items.slice(0, offset)]));
      };
    },
  },
  {
    name: 'lit-html repeat rotate 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      litRender(litRepeatedListView(items), target);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        litRender(litRepeatedListView([...items.slice(offset), ...items.slice(0, offset)]), target);
      };
    },
  },

  // 6. Repeat reverse 1k
  {
    name: 'litcode repeat reverse 1k',
    iterations: 20,
    warmup: 3,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = lcMount(lcRepeatedListView(items), target);
      const reversed = [...items].reverse();
      let flipped = false;
      return () => {
        flipped = !flipped;
        handle.update(lcRepeatedListView(flipped ? reversed : items));
      };
    },
  },
  {
    name: 'lit-html repeat reverse 1k',
    iterations: 20,
    warmup: 3,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      litRender(litRepeatedListView(items), target);
      const reversed = [...items].reverse();
      let flipped = false;
      return () => {
        flipped = !flipped;
        litRender(litRepeatedListView(flipped ? reversed : items), target);
      };
    },
  },

  // 7. Unkeyed patch 1k
  {
    name: 'litcode unkeyed patch 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      let offset = 0;
      const handle = lcMount(lcUnkeyedListView(0), target);
      return () => {
        offset += 1_000;
        handle.update(lcUnkeyedListView(offset));
      };
    },
  },
  {
    name: 'lit-html unkeyed patch 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      let offset = 0;
      litRender(litUnkeyedListView(0), target);
      return () => {
        offset += 1_000;
        litRender(litUnkeyedListView(offset), target);
      };
    },
  },

  // Extra litcode-only tests for completeness of litcode performance profiles
  {
    name: 'litcode append/remove children',
    iterations: 2_000,
    setup(target) {
      let expanded = false;
      const view = () =>
        lcHtml`<ul>
          ${Array.from({ length: expanded ? 100 : 50 }, (_, index) => lcHtml`<li>${index}</li>`)}
        </ul>`;
      const handle = lcMount(view(), target);
      return () => {
        expanded = !expanded;
        handle.update(view());
      };
    },
  },
  {
    name: 'litcode keyed reorder 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = lcMount(lcKeyedListView(items), target);
      const reversed = [...items].reverse();
      let flipped = false;
      return () => {
        flipped = !flipped;
        handle.update(lcKeyedListView(flipped ? reversed : items));
      };
    },
  },
  {
    name: 'litcode keyed rotate 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      const items = Array.from({ length: 1_000 }, (_, index) => index);
      const handle = lcMount(lcKeyedListView(items), target);
      let offset = 0;
      return () => {
        offset = (offset + 1) % items.length;
        handle.update(lcKeyedListView([...items.slice(offset), ...items.slice(0, offset)]));
      };
    },
  },
  {
    name: 'litcode keyed replace 1k',
    iterations: 100,
    warmup: 10,
    setup(target) {
      let offset = 0;
      const view = () =>
        lcKeyedListView(Array.from({ length: 1_000 }, (_, index) => index + offset));
      const handle = lcMount(view(), target);
      return () => {
        offset += 1_000;
        handle.update(view());
      };
    },
  },
  {
    name: 'litcode nested template parts',
    iterations: 2_000,
    setup(target) {
      let count = 0;
      const view = () => lcHtml`
        <main>
          <header><h1>${count}</h1></header>
          <section>
            ${Array.from(
              { length: 100 },
              (_, index) =>
                lcHtml`<article>
                  <h2>${index}</h2>
                  <p>${count + index}</p>
                </article>`,
            )}
          </section>
        </main>
      `;
      const handle = lcMount(view(), target);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'litcode component passthrough',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () => Passthrough({ children: lcHtml`<button>${count}</button>` });
      const handle = lcMount(view(), target);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'litcode component root props',
    iterations: 20_000,
    setup(target) {
      let count = 0;
      const view = () =>
        RootProp({
          className: count % 2 ? 'odd' : 'even',
          children: lcHtml`<button>${count}</button>`,
        });
      const handle = lcMount(view(), target);
      return () => {
        count++;
        handle.update(view());
      };
    },
  },
  {
    name: 'litcode keyed reorder 20',
    iterations: 5_000,
    setup(target) {
      const items = Array.from({ length: 20 }, (_, index) => index);
      const reversed = [...items].reverse();
      const handle = lcMount(lcKeyedListView(items), target);
      let flipped = false;
      return () => {
        flipped = !flipped;
        handle.update(lcKeyedListView(flipped ? reversed : items));
      };
    },
  },
  {
    name: 'litcode mount/destroy small tree',
    iterations: 5_000,
    setup(target) {
      let count = 0;
      return () => {
        const handle = lcMount(
          lcHtml`<section>
            <h1>${count}</h1>
            <button onclick="${() => count++}">Count ${count}</button>
            <p>${count % 2 ? 'odd' : 'even'}</p>
          </section>`,
          target,
        );
        handle.destroy();
        count++;
      };
    },
  },
];

console.log(`DOM browser benchmarks (${sampleCount} samples, ms/update)`);
window.__litcodeBenchResults = benches.map(runBench);
for (const result of window.__litcodeBenchResults) print(result);
window.__litcodeBenchDone = true;
