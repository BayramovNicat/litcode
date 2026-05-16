import './style.css';
import { $effect, $state, html, mount, type MountHandle, type View } from './lib';

type Route = 'home' | 'examples' | 'pokemon-game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('App root not found.');

const root = app;

const starterCount = $state(0);
const route = $state<Route>(routeFromPath(location.pathname));
const examplesPage = $state<((props: { navigate: typeof navigate }) => View) | null>(null);
const pokemonGame = $state<((target: HTMLElement) => void) | null>(null);
const lazyError = $state<string | null>(null);

let activeGame = false;
const handle: MountHandle = mount(App(), root);

function routeFromPath(path: string): Route {
  if (path.startsWith('/examples/pokemon-game')) return 'pokemon-game';
  if (path.startsWith('/examples')) return 'examples';
  return 'home';
}

function navigate(path: string): void {
  if (location.pathname === path) return;
  history.pushState({}, '', path);
  route.value = routeFromPath(path);
}

function HomePage({ onStart, onExamples }: { onStart: () => void; onExamples: () => void }): View {
  return html`
    <main
      class="min-h-screen bg-slate-50 px-6 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50"
    >
      <section
        class="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center"
      >
        <div
          class="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900"
        >
          <p
            class="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
          >
            litcode
          </p>
          <h1 class="text-4xl font-black tracking-tighter sm:text-5xl">
            Starter count: ${starterCount.value}
          </h1>
          <p class="mt-4 max-w-prose text-sm leading-6 text-slate-600 dark:text-slate-300">
            A tiny counter on the main page, plus lazy-loaded examples.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button
              class="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              onclick=${onStart}
            >
              Starter count
            </button>
            <button
              class="rounded-full bg-slate-200 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
              onclick=${onExamples}
            >
              Examples
            </button>
          </div>
        </div>
      </section>
    </main>
  `;
}

function LoadingPage({ label }: { label: string }): View {
  return html`
    <main class="grid min-h-screen place-items-center bg-slate-50 px-6 dark:bg-slate-950">
      <section
        class="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-slate-600 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        ${label}
      </section>
    </main>
  `;
}

function ErrorPage({ message }: { message: string }): View {
  return html`
    <main class="grid min-h-screen place-items-center bg-slate-50 px-6 dark:bg-slate-950">
      <section
        class="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl shadow-slate-950/5 dark:border-red-950 dark:bg-slate-900"
      >
        <p class="mb-3 text-xs font-black uppercase tracking-[0.18em] text-red-500">error</p>
        <h1 class="text-3xl font-black tracking-tighter text-slate-950 dark:text-slate-50">
          Could not load page
        </h1>
        <p class="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">${message}</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            class="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            onclick=${() => navigate('/')}
          >
            Back home
          </button>
        </div>
      </section>
    </main>
  `;
}

function App(): View {
  const message = lazyError.value;
  if (message) return ErrorPage({ message });

  if (route.value === 'examples') {
    return examplesPage.value?.({ navigate }) ?? LoadingPage({ label: 'Loading examples...' });
  }

  if (route.value === 'pokemon-game') {
    return LoadingPage({ label: 'Loading Pokémon game...' });
  }

  return HomePage({
    onStart() {
      starterCount.value += 1;
    },
    onExamples() {
      navigate('/examples');
    },
  });
}

function loadRouteAssets(nextRoute: Route): void {
  lazyError.value = null;

  if (nextRoute === 'examples' && !examplesPage.value) {
    void import('./pages/examples')
      .then(({ renderExamplesPage }) => {
        examplesPage.value = renderExamplesPage;
      })
      .catch((reason: unknown) => {
        lazyError.value = reason instanceof Error ? reason.message : 'Could not load examples.';
      });
  }

  if (nextRoute === 'pokemon-game' && !pokemonGame.value) {
    void import('../examples/pokemon-game/src/main')
      .then((module) => {
        pokemonGame.value = module.startPokemonGame;
      })
      .catch((reason: unknown) => {
        lazyError.value = reason instanceof Error ? reason.message : 'Could not load Pokémon game.';
      });
  }
}

window.addEventListener('popstate', () => {
  route.value = routeFromPath(location.pathname);
});

$effect(() => {
  const nextRoute = route.value;
  loadRouteAssets(nextRoute);

  if (nextRoute !== 'pokemon-game') activeGame = false;

  if (nextRoute === 'pokemon-game' && pokemonGame.value) {
    if (!activeGame) {
      activeGame = true;
      pokemonGame.value(root);
    }
    return;
  }

  handle.update(App());
});
