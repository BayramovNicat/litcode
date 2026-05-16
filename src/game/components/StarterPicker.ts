import { Button, Card } from '@/components';
import { component, html } from '@/lib';
import { chooseStarter } from '@/game/actions';
import { allPokemon } from '@/game/state';
import type { Pokemon } from '@/game/types';
import type { StarterId } from '@/game/types';
import { PokemonCard } from '@/game/components/PokemonCard';

const starters: StarterId[] = [1, 4, 7, 25];

function isPokemon(value: Pokemon | undefined): value is Pokemon {
  return Boolean(value);
}

export const StarterPicker = component(() => {
  const starterPokemon = starters
    .map((id) => allPokemon.value.find((pokemon) => pokemon.id === id))
    .filter(isPokemon);

  return Card({
    className: 'grid gap-5',
    children: html`
      <div>
        <h2 class="text-2xl font-bold text-slate-950 dark:text-white">Choose your starter</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Pick a partner before entering the tall grass.
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        ${starterPokemon.map(
          (pokemon) => html`
            <div class="grid gap-3">
              ${PokemonCard({ pokemon, compact: true })}
              ${Button({
                label: `Choose ${pokemon.name}`,
                onclick: () => chooseStarter(pokemon.id as StarterId),
              })}
            </div>
          `,
        )}
      </div>
    `,
  });
});
