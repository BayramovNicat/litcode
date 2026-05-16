import type { LearnableMove, Pokemon, PokemonEvolution, PokemonMove } from '../types';

type PokeApiListResponse = {
  results: { name: string; url: string }[];
};

type PokeApiPokemonResponse = {
  id: number;
  name: string;
  sprites: {
    front_default: string | null;
    other?: {
      'official-artwork'?: {
        front_default: string | null;
      };
    };
  };
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  moves: {
    move: { name: string; url: string };
    version_group_details: { level_learned_at: number; move_learn_method: { name: string } }[];
  }[];
  species: { url: string };
};

type PokeApiMoveResponse = {
  name: string;
  power: number | null;
  type: { name: string };
};

type PokeApiSpeciesResponse = {
  evolution_chain: { url: string };
};

type PokeApiEvolutionChainResponse = {
  chain: EvolutionChainLink;
};

type EvolutionChainLink = {
  species: { name: string; url: string };
  evolution_details: { min_level: number | null }[];
  evolves_to: EvolutionChainLink[];
};

const GEN_1_URL = 'https://pokeapi.co/api/v2/pokemon?limit=151';

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stat(data: PokeApiPokemonResponse, name: string): number {
  return data.stats.find((entry) => entry.stat.name === name)?.base_stat ?? 1;
}

function fallbackMoves(types: string[]): LearnableMove[] {
  return [
    { name: 'Tackle', power: 40, type: 'Normal', level: 1 },
    { name: 'Quick Attack', power: 40, type: 'Normal', level: 7 },
    { name: `${types[0] ?? 'Normal'} Strike`, power: 50, type: types[0] ?? 'Normal', level: 12 },
    { name: 'Swift', power: 60, type: 'Normal', level: 18 },
  ];
}

function uniqueMoves<T extends PokemonMove>(moves: T[]): T[] {
  const seen = new Set<string>();
  return moves.filter((move) => {
    const key = move.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchPokemonLearnset(data: PokeApiPokemonResponse): Promise<LearnableMove[]> {
  const levelUpMoves = data.moves
    .map((entry) => {
      const detail = entry.version_group_details.find(
        (version) => version.move_learn_method.name === 'level-up' && version.level_learned_at > 0,
      );
      return detail ? { entry, level: detail.level_learned_at } : null;
    })
    .filter(
      (entry): entry is { entry: PokeApiPokemonResponse['moves'][number]; level: number } =>
        entry !== null,
    )
    .sort((left, right) => left.level - right.level)
    .slice(0, 40);

  const moves = await Promise.all(
    levelUpMoves.map(async ({ entry, level }) => {
      try {
        const response = await fetch(entry.move.url);
        if (!response.ok) return null;
        const move = (await response.json()) as PokeApiMoveResponse;
        return {
          name: titleCase(move.name),
          power: move.power ?? 40,
          type: titleCase(move.type.name),
          level,
        } satisfies LearnableMove;
      } catch {
        return null;
      }
    }),
  );

  const types = data.types.map((entry) => titleCase(entry.type.name));
  return uniqueMoves([
    ...moves.filter((move): move is LearnableMove => move !== null),
    ...fallbackMoves(types),
  ]).sort((left, right) => left.level - right.level);
}

function pokemonIdFromSpeciesUrl(url: string): number | null {
  const id = Number(url.match(/pokemon-species\/(\d+)\/$/)?.[1]);
  return Number.isFinite(id) ? id : null;
}

function findEvolution(link: EvolutionChainLink, pokemonId: number): PokemonEvolution | undefined {
  const linkId = pokemonIdFromSpeciesUrl(link.species.url);
  if (linkId === pokemonId) {
    const next = link.evolves_to[0];
    const nextId = next ? pokemonIdFromSpeciesUrl(next.species.url) : null;
    if (!next || !nextId || nextId > 151) return undefined;
    return { id: nextId, level: next.evolution_details[0]?.min_level ?? 16 };
  }

  for (const next of link.evolves_to) {
    const evolution = findEvolution(next, pokemonId);
    if (evolution) return evolution;
  }

  return undefined;
}

async function fetchEvolution(data: PokeApiPokemonResponse): Promise<PokemonEvolution | undefined> {
  try {
    const speciesResponse = await fetch(data.species.url);
    if (!speciesResponse.ok) return undefined;
    const species = (await speciesResponse.json()) as PokeApiSpeciesResponse;
    const chainResponse = await fetch(species.evolution_chain.url);
    if (!chainResponse.ok) return undefined;
    const chain = (await chainResponse.json()) as PokeApiEvolutionChainResponse;
    return findEvolution(chain.chain, data.id);
  } catch {
    return undefined;
  }
}

async function mapPokemon(data: PokeApiPokemonResponse): Promise<Pokemon> {
  const learnset = await fetchPokemonLearnset(data);
  return {
    id: data.id,
    name: titleCase(data.name),
    sprite:
      data.sprites.other?.['official-artwork']?.front_default ??
      data.sprites.front_default ??
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${data.id}.png`,
    types: data.types.map((entry) => titleCase(entry.type.name)),
    moves: learnset.slice(0, 4).map(({ level: _, ...move }) => move),
    learnset,
    evolution: await fetchEvolution(data),
    hp: stat(data, 'hp'),
    attack: stat(data, 'attack'),
    defense: stat(data, 'defense'),
    speed: stat(data, 'speed'),
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function fetchGenOnePokemon(): Promise<Pokemon[]> {
  const listResponse = await fetch(GEN_1_URL);
  if (!listResponse.ok) throw new Error('Could not load Pokémon list.');

  const list = (await listResponse.json()) as PokeApiListResponse;
  const pokemon: Pokemon[] = [];

  for (const batch of chunks(list.results, 24)) {
    const details = await Promise.all(
      batch.map(async (entry) => {
        const response = await fetch(entry.url);
        if (!response.ok) throw new Error(`Could not load ${entry.name}.`);
        return mapPokemon((await response.json()) as PokeApiPokemonResponse);
      }),
    );
    pokemon.push(...details);
  }

  return pokemon.sort((left, right) => left.id - right.id);
}
