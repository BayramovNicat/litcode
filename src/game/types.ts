export type PokemonType = string;

export type Pokemon = {
  id: number;
  name: string;
  sprite: string;
  types: PokemonType[];
  moves: PokemonMove[];
  learnset: LearnableMove[];
  evolution?: PokemonEvolution;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

export type PokemonMove = {
  name: string;
  power: number;
  type: PokemonType;
};

export type LearnableMove = PokemonMove & {
  level: number;
};

export type PokemonEvolution = {
  id: number;
  level: number;
};

export type BattlePokemon = Pokemon & {
  currentHp: number;
  maxHp: number;
  level: number;
  exp: number;
  expToNextLevel: number;
};

export type LocationId =
  | 'pallet-town'
  | 'viridian-forest'
  | 'mt-moon'
  | 'cerulean-cave'
  | 'seafoam-islands'
  | 'power-plant';

export type GameLocation = {
  id: LocationId;
  name: string;
  description: string;
  encounterRate: number;
  pokemonIds: number[];
};

export type ItemId = 'potion' | 'super-potion' | 'pokeball' | 'greatball';

export type GameItem = {
  id: ItemId;
  name: string;
  description: string;
  kind: 'heal' | 'catch';
  power: number;
};

export type InventoryEntry = {
  itemId: ItemId;
  quantity: number;
};

export type StarterId = 1 | 4 | 7 | 25;
