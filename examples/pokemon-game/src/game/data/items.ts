import type { GameItem, InventoryEntry } from '../types';

export const items: GameItem[] = [
  {
    id: 'potion',
    name: 'Potion',
    description: 'Restore 20 HP to your active Pokémon.',
    kind: 'heal',
    power: 20,
  },
  {
    id: 'super-potion',
    name: 'Super Potion',
    description: 'Restore 50 HP to your active Pokémon.',
    kind: 'heal',
    power: 50,
  },
  {
    id: 'pokeball',
    name: 'Poké Ball',
    description: 'Try to catch a wild Pokémon.',
    kind: 'catch',
    power: 1,
  },
  {
    id: 'greatball',
    name: 'Great Ball',
    description: 'A better ball with a stronger catch rate.',
    kind: 'catch',
    power: 1.35,
  },
];

export const startingInventory: InventoryEntry[] = [
  { itemId: 'potion', quantity: 5 },
  { itemId: 'super-potion', quantity: 2 },
  { itemId: 'pokeball', quantity: 12 },
  { itemId: 'greatball', quantity: 4 },
];

export function getItem(itemId: string): GameItem | undefined {
  return items.find((item) => item.id === itemId);
}
