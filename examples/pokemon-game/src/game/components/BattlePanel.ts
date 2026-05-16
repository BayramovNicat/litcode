import { component, html } from '@/lib';
import { attackWildPokemon, runFromBattle, useItem } from '../actions';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { activePokemon, wildPokemon } from '../state';
import { PokemonCard } from './PokemonCard';

export const BattlePanel = component(() => {
  const player = activePokemon.value;
  const playerFainted = !player || player.currentHp <= 0;

  return Card({
    className: 'grid gap-5',
    children: html`
      <div>
        <h2 class="text-xl font-bold text-slate-950 dark:text-white">Battle</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Attack, catch, heal, or run.</p>
      </div>
      ${wildPokemon.value
        ? html`
            <div class="grid gap-4 lg:grid-cols-2">
              ${player ? PokemonCard({ pokemon: player }) : null}
              ${PokemonCard({ pokemon: wildPokemon.value })}
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              ${(player?.moves ?? []).map((move) =>
                Button({
                  label: `${move.name} (${move.type} ${move.power})`,
                  onclick: () => attackWildPokemon(move),
                  disabled: playerFainted,
                }),
              )}
            </div>
            <div class="grid gap-2 sm:grid-cols-3">
              ${Button({
                label: 'Poké Ball',
                variant: 'secondary',
                onclick: () => useItem('pokeball'),
                disabled: playerFainted,
              })}
              ${Button({ label: 'Potion', variant: 'ghost', onclick: () => useItem('potion') })}
              ${Button({ label: 'Run', variant: 'danger', onclick: runFromBattle })}
            </div>
          `
        : EmptyState({
            title: 'No active battle',
            message: 'Search a location to find wild Pokémon.',
          })}
    `,
  });
});
