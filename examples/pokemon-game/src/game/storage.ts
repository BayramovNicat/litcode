import { startingInventory } from './data/items';
import { getLocation } from './data/locations';
import {
  battleLog,
  currentLocationId,
  hasStarter,
  inventory,
  party,
  trainerName,
  wildPokemon,
} from './state';
import type {
  BattlePokemon,
  InventoryEntry,
  LearnableMove,
  LocationId,
  PokemonMove,
} from './types';

const saveKey = 'kanto-runes-save';

type SavedGame = {
  version: 1;
  trainerName: string;
  hasStarter: boolean;
  currentLocationId: LocationId;
  party: BattlePokemon[];
  inventory: InventoryEntry[];
  wildPokemon: BattlePokemon | null;
  battleLog: string[];
};

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function isBattlePokemon(value: unknown): value is BattlePokemon {
  if (!value || typeof value !== 'object') return false;
  const pokemon = value as Partial<BattlePokemon>;
  return (
    typeof pokemon.id === 'number' &&
    typeof pokemon.name === 'string' &&
    typeof pokemon.sprite === 'string' &&
    Array.isArray(pokemon.types) &&
    Array.isArray(pokemon.moves) &&
    pokemon.moves.every(isPokemonMove) &&
    Array.isArray(pokemon.learnset) &&
    pokemon.learnset.every(isLearnableMove) &&
    typeof pokemon.hp === 'number' &&
    typeof pokemon.attack === 'number' &&
    typeof pokemon.defense === 'number' &&
    typeof pokemon.speed === 'number' &&
    typeof pokemon.currentHp === 'number' &&
    typeof pokemon.maxHp === 'number' &&
    typeof pokemon.level === 'number' &&
    typeof pokemon.exp === 'number' &&
    typeof pokemon.expToNextLevel === 'number'
  );
}

function isPokemonMove(value: unknown): value is PokemonMove {
  if (!value || typeof value !== 'object') return false;
  const move = value as Partial<PokemonMove>;
  return (
    typeof move.name === 'string' && typeof move.power === 'number' && typeof move.type === 'string'
  );
}

function isLearnableMove(value: unknown): value is LearnableMove {
  return isPokemonMove(value) && typeof (value as Partial<LearnableMove>).level === 'number';
}

function isInventory(value: unknown): value is InventoryEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof (entry as InventoryEntry).itemId === 'string' &&
        typeof (entry as InventoryEntry).quantity === 'number',
    )
  );
}

function createSavedGame(): SavedGame {
  return {
    version: 1,
    trainerName: trainerName.value,
    hasStarter: hasStarter.value,
    currentLocationId: currentLocationId.value,
    party: party.value,
    inventory: inventory.value,
    wildPokemon: wildPokemon.value,
    battleLog: battleLog.value,
  };
}

export function loadSavedGame(): void {
  if (!canUseLocalStorage()) return;

  try {
    const saved = localStorage.getItem(saveKey);
    if (!saved) return;

    const data = JSON.parse(saved) as Partial<SavedGame>;
    trainerName.value = typeof data.trainerName === 'string' ? data.trainerName : 'Ash';
    hasStarter.value = data.hasStarter === true;
    currentLocationId.value = getLocation(data.currentLocationId ?? '').id;
    party.value = Array.isArray(data.party) ? data.party.filter(isBattlePokemon) : [];
    inventory.value = isInventory(data.inventory)
      ? data.inventory
      : structuredClone(startingInventory);
    wildPokemon.value = isBattlePokemon(data.wildPokemon) ? data.wildPokemon : null;
    battleLog.value = Array.isArray(data.battleLog)
      ? data.battleLog.filter((entry): entry is string => typeof entry === 'string').slice(0, 8)
      : ['Welcome back to Kanto.'];
  } catch {
    localStorage.removeItem(saveKey);
  }
}

export function saveGame(): void {
  if (!canUseLocalStorage()) return;

  try {
    localStorage.setItem(saveKey, JSON.stringify(createSavedGame()));
  } catch {
    // Ignore storage quota/private-mode errors so gameplay can continue.
  }
}
