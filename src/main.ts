import './style.css';
import { $derived, $effect, $state, component, html, mount } from './lib';

type ButtonProps = {
  label: string;
  onclick: () => void;
};

const Button = component<ButtonProps>(
  ({ label, onclick }) => html`
    <button
      type="button"
      onclick=${onclick}
      class="inline-flex items-center rounded-md border-2 border-transparent bg-violet-500/10 px-3 py-1.5 font-mono text-sm text-violet-700 transition hover:border-violet-500/60 focus-visible:outline-2 focus-visible:outline-violet-500 focus-visible:outline-offset-2 dark:text-violet-300"
    >
      ${label}
    </button>
  `,
);

const App = component(() => {
  const count = $state(0);
  const doubled = $derived(() => count.value * 2);

  const view = () => html`
    <main
      class="mx-auto flex min-h-screen w-full max-w-5xl flex-col border-x border-slate-200 text-center text-slate-600 dark:border-slate-800 dark:text-slate-300"
    >
      <section class="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 sm:py-10">
        <h1
          class="text-4xl font-medium tracking-[-0.04em] text-slate-900 sm:text-6xl dark:text-slate-50"
        >
          Litcode
        </h1>
        <p class="max-w-xl text-base leading-7 sm:text-lg">
          Minimal TypeScript frontend rendering for better vanilla JS.
        </p>
        ${Button({
          label: `count is ${count.value}`,
          onclick: () => (count.value += 1),
        })}
        <p class="text-base text-slate-700 dark:text-slate-200">
          Doubled: <span class="font-semibold">${doubled.value}</span>
        </p>
      </section>

      <section
        class="border-t border-slate-200 bg-slate-50 px-5 py-8 text-left dark:border-slate-800 dark:bg-slate-900/60 sm:px-8"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <article
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
          >
            <h2
              class="mb-2 text-xl font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-50"
            >
              Components
            </h2>
            <p>Write modular UI as typed functions and compose them like normal JavaScript.</p>
          </article>

          <article
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
          >
            <h2
              class="mb-2 text-xl font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-50"
            >
              Runes
            </h2>
            <p>
              Use
              <code
                class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                >$state</code
              >,
              <code
                class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                >$derived</code
              >, and
              <code
                class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                >$effect</code
              >
              for reactive data.
            </p>
          </article>
        </div>
      </section>
    </main>
  `;

  const handle = mount(view(), document.querySelector<HTMLDivElement>('#app')!);

  $effect(() => {
    handle.update(view());
  });
});

App({});
