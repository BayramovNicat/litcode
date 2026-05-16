import { mkdir, writeFile } from 'node:fs/promises';

const GEN_1_URL = 'https://pokeapi.co/api/v2/pokemon?limit=151';
const OUTPUT_DIR = new URL('../public/data/', import.meta.url);
const OUTPUT_FILE = new URL('./gen1-pokemon.json', OUTPUT_DIR);
const RAW_LIST_FILE = new URL('./gen1-list.json', OUTPUT_DIR);

function titleCase(value) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stat(data, name) {
  return data.stats.find((entry) => entry.stat.name === name)?.base_stat ?? 1;
}

function fallbackMoves(types) {
  return [
    { name: 'Tackle', power: 40, type: 'Normal', level: 1 },
    { name: 'Quick Attack', power: 40, type: 'Normal', level: 7 },
    { name: `${types[0] ?? 'Normal'} Strike`, power: 50, type: types[0] ?? 'Normal', level: 12 },
    { name: 'Swift', power: 60, type: 'Normal', level: 18 },
  ];
}

function uniqueMoves(moves) {
  const seen = new Set();
  return moves.filter((move) => {
    const key = move.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed for ${url}`);
  return response.json();
}

async function fetchPokemonLearnset(data) {
  const levelUpMoves = data.moves
    .map((entry) => {
      const detail = entry.version_group_details.find(
        (version) => version.move_learn_method.name === 'level-up' && version.level_learned_at > 0,
      );
      return detail ? { entry, level: detail.level_learned_at } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.level - right.level)
    .slice(0, 40);

  const moves = await Promise.all(
    levelUpMoves.map(async ({ entry, level }) => {
      try {
        const move = await fetchJson(entry.move.url);
        return {
          name: titleCase(move.name),
          power: move.power ?? 40,
          type: titleCase(move.type.name),
          level,
        };
      } catch {
        return null;
      }
    }),
  );

  const types = data.types.map((entry) => titleCase(entry.type.name));
  return uniqueMoves([
    ...moves.filter(Boolean),
    ...fallbackMoves(types),
  ]).sort((left, right) => left.level - right.level);
}

function pokemonIdFromSpeciesUrl(url) {
  const id = Number(url.match(/pokemon-species\/(\d+)\/$/)?.[1]);
  return Number.isFinite(id) ? id : null;
}

function findEvolution(link, pokemonId) {
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

async function fetchEvolution(data) {
  try {
    const species = await fetchJson(data.species.url);
    const chain = await fetchJson(species.evolution_chain.url);
    return findEvolution(chain.chain, data.id);
  } catch {
    return undefined;
  }
}

async function mapPokemon(data) {
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

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const list = await fetchJson(GEN_1_URL);
  await writeFile(RAW_LIST_FILE, `${JSON.stringify(list, null, 2)}\n`);

  const pokemon = [];
  for (const batch of chunks(list.results, 24)) {
    const details = await Promise.all(
      batch.map(async (entry) => {
        const data = await fetchJson(entry.url);
        return mapPokemon(data);
      }),
    );
    pokemon.push(...details);
  }

  pokemon.sort((left, right) => left.id - right.id);
  await writeFile(OUTPUT_FILE, `${JSON.stringify(pokemon, null, 2)}\n`);
  console.log(`Wrote ${pokemon.length} Pokémon to ${OUTPUT_FILE.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
