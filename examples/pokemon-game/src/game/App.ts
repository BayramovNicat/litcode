import { $effect, component, html, mount } from '@/lib';
import { fetchGenOnePokemon } from './api/pokeapi';
import { Card } from '../components/Card';
import { Spinner } from '../components/Spinner';
import { BattleLog } from './components/BattleLog';
import { BattlePanel } from './components/BattlePanel';
import { Header } from './components/Header';
import { InventoryList } from './components/InventoryList';
import { LocationPanel } from './components/LocationPanel';
import { PlayerPanel } from './components/PlayerPanel';
import { StarterPicker } from './components/StarterPicker';
import { loadSavedGame, saveGame } from './storage';
import {
  allPokemon,
  battleLog,
  currentLocationId,
  error,
  hasStarter,
  inventory,
  loading,
  log,
  party,
  trainerName,
  wildPokemon,
} from './state';

function loadPokemon(): void {
  loading.value = true;
  error.value = null;

  fetchGenOnePokemon()
    .then((pokemon) => {
      allPokemon.value = pokemon;
      log(`Loaded ${pokemon.length} Gen 1 Pokémon from PokéAPI.`);
    })
    .catch((reason: unknown) => {
      error.value = reason instanceof Error ? reason.message : 'Could not load Pokémon.';
    })
    .finally(() => {
      loading.value = false;
    });
}

const LoadingView = component(
  () => html`
    <main class="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      ${Card({
        className: 'max-w-md text-center',
        children: html`
          <h1 class="mb-4 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
            Kanto Runes
          </h1>
          ${Spinner({})}
        `,
      })}
    </main>
  `,
);

const ErrorView = component(
  () => html`
    <main class="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      ${Card({
        className: 'max-w-md text-center',
        children: html`
          <h1 class="text-2xl font-bold text-slate-950 dark:text-white">PokéAPI error</h1>
          <p class="mt-2 text-slate-500 dark:text-slate-400">${error.value}</p>
        `,
      })}
    </main>
  `,
);

const GameView = component(
  () => html`
    <main class="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div class="mx-auto grid max-w-7xl gap-6">
        ${Header({})} ${hasStarter.value ? null : StarterPicker({})}
        <div class="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside class="grid content-start gap-6">${PlayerPanel({})} ${InventoryList({})}</aside>
          <section class="grid content-start gap-6">
            ${LocationPanel({})} ${BattlePanel({})} ${BattleLog({})}
          </section>
        </div>
      </div>
    </main>
  `,
);

const Root = component(() => {
  if (loading.value) return LoadingView({});
  if (error.value) return ErrorView({});
  return GameView({});
});

export function startGame(target: HTMLElement): void {
  loadSavedGame();
  loadPokemon();

  const handle = mount(Root({}), target);

  $effect(() => {
    handle.update(Root({}));
  });

  $effect(() => {
    trainerName.value;
    hasStarter.value;
    currentLocationId.value;
    party.value;
    inventory.value;
    wildPokemon.value;
    battleLog.value;
    saveGame();
  });
}
