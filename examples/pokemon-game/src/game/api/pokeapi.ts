import type { Pokemon } from '../types';

type CachedPokemonResponse = Pokemon[];

const GEN_1_CACHE_URL = '/data/gen1-pokemon.json';

export async function fetchGenOnePokemon(): Promise<Pokemon[]> {
  const response = await fetch(GEN_1_CACHE_URL);
  if (!response.ok) {
    throw new Error('Could not load cached Pokémon data. Run npm run generate:gen1-cache.');
  }

  return (await response.json()) as CachedPokemonResponse;
}
