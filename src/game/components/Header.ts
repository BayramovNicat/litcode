import { Badge } from '../../components';
import { component, html } from '../../lib';
import { caughtCount, currentLocation, trainerName } from '../state';

export const Header = component(
  () => html`
    <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="mb-3 flex flex-wrap gap-2">
          ${Badge({ label: 'PokéAPI Gen 1', tone: 'red' })}
          ${Badge({ label: `${caughtCount.value} caught`, tone: 'green' })}
        </div>
        <h1
          class="text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-6xl dark:text-white"
        >
          Kanto Runes
        </h1>
        <p class="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          A tiny TypeScript Pokémon game powered by Litcode components, runes, Tailwind, and live
          PokéAPI data.
        </p>
      </div>
      <div
        class="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
      >
        <p class="font-semibold text-slate-950 dark:text-white">
          ${trainerName.value || 'Trainer'}
        </p>
        <p class="text-slate-500 dark:text-slate-400">Currently in ${currentLocation.value.name}</p>
      </div>
    </header>
  `,
);
