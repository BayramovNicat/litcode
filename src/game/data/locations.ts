import type { GameLocation } from '../types';

export const locations: GameLocation[] = [
  {
    id: 'pallet-town',
    name: 'Pallet Town',
    description: 'A quiet Kanto town where every trainer story starts.',
    encounterRate: 0.55,
    pokemonIds: [16, 19, 21, 29, 32, 43, 54, 60],
  },
  {
    id: 'viridian-forest',
    name: 'Viridian Forest',
    description: 'A dense forest filled with bugs, birds, and the rare electric mouse.',
    encounterRate: 0.75,
    pokemonIds: [10, 11, 12, 13, 14, 15, 16, 25, 43, 46, 48],
  },
  {
    id: 'mt-moon',
    name: 'Mt. Moon',
    description: 'Moon stones, caves, and sturdy rock Pokémon wait inside.',
    encounterRate: 0.8,
    pokemonIds: [27, 35, 39, 41, 42, 46, 47, 74, 75, 95],
  },
  {
    id: 'cerulean-cave',
    name: 'Cerulean Cave',
    description: 'A dangerous cave where powerful psychic and dragon Pokémon gather.',
    encounterRate: 0.9,
    pokemonIds: [24, 42, 49, 64, 65, 82, 94, 112, 132, 147, 148, 150],
  },
  {
    id: 'seafoam-islands',
    name: 'Seafoam Islands',
    description: 'Cold waves hide water and ice Pokémon in the caverns.',
    encounterRate: 0.82,
    pokemonIds: [54, 55, 72, 73, 86, 87, 90, 91, 98, 99, 116, 117, 131, 144],
  },
  {
    id: 'power-plant',
    name: 'Power Plant',
    description: 'Abandoned machinery crackles with electric energy.',
    encounterRate: 0.78,
    pokemonIds: [25, 26, 81, 82, 100, 101, 125, 145],
  },
];

export function getLocation(locationId: string): GameLocation {
  return locations.find((location) => location.id === locationId) ?? locations[0];
}
