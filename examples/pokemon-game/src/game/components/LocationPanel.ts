import { component, html } from '@/lib';
import { healAtPokemonCenter, searchForPokemon, travelTo } from '../actions';
import { locations } from '../data/locations';
import { activePokemon, currentLocation, currentLocationId, hasStarter } from '../state';
import type { LocationId } from '../types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

export const LocationPanel = component(() => {
  const player = activePokemon.value;
  const canSearch = hasStarter.value && !!player && player.currentHp > 0;

  return Card({
    className: 'grid gap-5',
    children: html`
      <div>
        <h2 class="text-xl font-bold text-slate-950 dark:text-white">
          ${currentLocation.value.name}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          ${currentLocation.value.description}
        </p>
      </div>
      ${Button({
        label: 'Search the area',
        onclick: searchForPokemon,
        disabled: !canSearch,
        className: 'w-full',
      })}
      ${Button({
        label: 'Heal at Pokémon Center',
        variant: 'secondary',
        onclick: healAtPokemonCenter,
        disabled: !hasStarter.value,
        className: 'w-full',
      })}
      <div class="grid gap-2 sm:grid-cols-2">
        ${locations.map((location) =>
          Button({
            label: location.name,
            variant: location.id === currentLocationId.value ? 'secondary' : 'ghost',
            onclick: () => travelTo(location.id as LocationId),
          }),
        )}
      </div>
    `,
  });
});
