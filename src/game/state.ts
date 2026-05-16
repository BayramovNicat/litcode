import { $derived, $state } from '@/lib';
import { startingInventory } from '@/game/data/items';
import { getLocation } from '@/game/data/locations';
import type { BattlePokemon, InventoryEntry, LocationId, Pokemon } from '@/game/types';

export const allPokemon = $state<Pokemon[]>([]);
export const loading = $state(true);
export const error = $state<string | null>(null);

export const trainerName = $state('Ash');
export const hasStarter = $state(false);
export const currentLocationId = $state<LocationId>('pallet-town');

export const party = $state<BattlePokemon[]>([]);
export const inventory = $state<InventoryEntry[]>(structuredClone(startingInventory));
export const wildPokemon = $state<BattlePokemon | null>(null);
export const battleLog = $state<string[]>([
  'Welcome to Kanto. Pick a starter, then search the grass.',
]);

export const currentLocation = $derived(() => getLocation(currentLocationId.value));
export const activePokemon = $derived(() => party.value[0] ?? null);
export const caughtCount = $derived(() => party.value.length);

export function log(message: string): void {
  battleLog.value = [message, ...battleLog.value].slice(0, 8);
}
