import { html, type View } from '../lib';

type Navigate = (path: string) => void;

export function renderExamplesPage({ navigate }: { navigate: Navigate }): View {
  return html`
    <main class="grid min-h-screen place-items-center bg-slate-50 px-6 dark:bg-slate-950">
      <section class="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900">
        <p class="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          examples
        </p>
        <h1 class="text-3xl font-black tracking-[-0.05em] text-slate-950 dark:text-slate-50">
          Lazy-loaded examples page
        </h1>
        <p class="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Open the Pokémon game example from here. The game module is loaded only when needed.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            class="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            onclick=${() => navigate('/examples/pokemon-game')}
          >
            Open Pokémon game
          </button>
          <button
            class="rounded-full bg-slate-200 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
            onclick=${() => navigate('/')}
          >
            Back home
          </button>
        </div>
      </section>
    </main>
  `;
}
