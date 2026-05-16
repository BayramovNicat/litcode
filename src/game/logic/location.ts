import { getLocation } from '@/game/data/locations';
import type { BattlePokemon, LocationId, Pokemon } from '@/game/types';
import { createBattlePokemon } from '@/game/logic/battle';

function sample<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function findWildPokemon(
  pokemon: Pokemon[],
  locationId: LocationId,
): BattlePokemon | undefined {
  const location = getLocation(locationId);
  const candidates = location.pokemonIds
    .map((id) => pokemon.find((entry) => entry.id === id))
    .filter((entry): entry is Pokemon => Boolean(entry));

  if (candidates.length === 0) return undefined;
  return createBattlePokemon(sample(candidates));
}
