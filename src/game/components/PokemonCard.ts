import { Badge, ProgressBar } from '../../components';
import { component, html } from '../../lib';
import type { BattlePokemon, Pokemon } from '../types';

export type PokemonCardProps = {
  pokemon: Pokemon | BattlePokemon;
  compact?: boolean;
};

function isBattlePokemon(pokemon: Pokemon | BattlePokemon): pokemon is BattlePokemon {
  return 'currentHp' in pokemon;
}

export const PokemonCard = component<PokemonCardProps>(
  ({ pokemon, compact = false }) => html`
    <article
      class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div class="flex items-center gap-4">
        <img
          src="${pokemon.sprite}"
          alt="${pokemon.name}"
          class="h-20 w-20 rounded-2xl bg-white object-contain p-2 dark:bg-slate-950"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-bold text-slate-400">
                #${String(pokemon.id).padStart(3, '0')}
              </p>
              <h3 class="truncate text-lg font-bold text-slate-950 dark:text-white">
                ${pokemon.name}
              </h3>
              ${isBattlePokemon(pokemon)
                ? html`<p class="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Lv. ${pokemon.level}
                  </p>`
                : null}
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            ${pokemon.types.map((type) => Badge({ label: type, tone: 'blue' }))}
          </div>
        </div>
      </div>
      ${isBattlePokemon(pokemon)
        ? html`<div class="mt-4">
            ${ProgressBar({ value: pokemon.currentHp, max: pokemon.maxHp })}
            <div class="mt-2">
              <p class="mb-1 text-xs font-bold text-slate-400">
                EXP ${pokemon.exp}/${pokemon.expToNextLevel}
              </p>
              ${ProgressBar({ value: pokemon.exp, max: pokemon.expToNextLevel })}
            </div>
          </div>`
        : null}
      ${compact
        ? null
        : html`
            <dl class="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div class="rounded-xl bg-white p-2 dark:bg-slate-950">
                <dt class="text-slate-400">ATK</dt>
                <dd class="font-bold text-slate-900 dark:text-white">${pokemon.attack}</dd>
              </div>
              <div class="rounded-xl bg-white p-2 dark:bg-slate-950">
                <dt class="text-slate-400">DEF</dt>
                <dd class="font-bold text-slate-900 dark:text-white">${pokemon.defense}</dd>
              </div>
              <div class="rounded-xl bg-white p-2 dark:bg-slate-950">
                <dt class="text-slate-400">SPD</dt>
                <dd class="font-bold text-slate-900 dark:text-white">${pokemon.speed}</dd>
              </div>
            </dl>
          `}
    </article>
  `,
);
