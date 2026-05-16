import { Badge, Button, Card, EmptyState, Input } from '../../components';
import { component, html } from '../../lib';
import { switchActivePokemon, updateTrainerName } from '../actions';
import { party, trainerName, wildPokemon } from '../state';
import { PokemonCard } from './PokemonCard';

export const PlayerPanel = component(() =>
  Card({
    className: 'grid gap-5',
    children: html`
      <div>
        <h2 class="text-xl font-bold text-slate-950 dark:text-white">Trainer</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Manage your name and party.</p>
      </div>
      ${Input({ label: 'Trainer name', value: trainerName.value, oninput: updateTrainerName })}
      <div class="grid gap-3">
        <h3 class="text-sm font-bold uppercase tracking-wide text-slate-400">Party</h3>
        ${party.value.length === 0
          ? EmptyState({ title: 'No Pokémon yet', message: 'Choose a starter to begin.' })
          : party.value.map(
              (pokemon, index) => html`
                <div class="grid gap-2">
                  <div class="flex items-center gap-2">
                    ${index === 0 ? Badge({ label: 'Active', tone: 'green' }) : null}
                    ${pokemon.currentHp <= 0 ? Badge({ label: 'Fainted', tone: 'red' }) : null}
                  </div>
                  ${PokemonCard({ pokemon, compact: true })}
                  <div class="flex flex-wrap gap-1.5">
                    ${pokemon.moves.map((move) => Badge({ label: move.name, tone: 'blue' }))}
                  </div>
                  ${wildPokemon.value && index !== 0
                    ? Button({
                        label: `Choose ${pokemon.name}`,
                        variant: 'secondary',
                        onclick: () => switchActivePokemon(index),
                        disabled: pokemon.currentHp <= 0,
                      })
                    : null}
                </div>
              `,
            )}
      </div>
    `,
  }),
);
