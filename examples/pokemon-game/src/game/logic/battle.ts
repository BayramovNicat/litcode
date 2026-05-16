import type { BattlePokemon, Pokemon, PokemonMove } from '../types';

export function createBattlePokemon(pokemon: Pokemon): BattlePokemon {
  return {
    ...pokemon,
    maxHp: pokemon.hp,
    currentHp: pokemon.hp,
    level: 5,
    exp: 0,
    expToNextLevel: expToNextLevel(5),
  };
}

export function expToNextLevel(level: number): number {
  return 40 + level * 15;
}

export function expReward(target: BattlePokemon): number {
  return Math.max(20, Math.floor((target.hp + target.attack + target.defense + target.speed) / 4));
}

export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move?: PokemonMove,
): number {
  const randomBonus = Math.floor(Math.random() * 8);
  const movePower = move?.power ?? 40;
  const sameTypeBonus = move && attacker.types.includes(move.type) ? 1.2 : 1;
  const base =
    (attacker.attack / 2 + movePower / 4) * sameTypeBonus - defender.defense / 5 + randomBonus;
  return Math.max(1, Math.floor(base));
}

export function applyDamage(target: BattlePokemon, damage: number): BattlePokemon {
  return {
    ...target,
    currentHp: Math.max(0, target.currentHp - damage),
  };
}

export function healPokemon(target: BattlePokemon, amount: number): BattlePokemon {
  return {
    ...target,
    currentHp: Math.min(target.maxHp, target.currentHp + amount),
  };
}

export function catchChance(target: BattlePokemon, ballPower: number): number {
  const hpRatio = target.currentHp / target.maxHp;
  return Math.max(0.12, Math.min(0.92, (0.72 - hpRatio * 0.45) * ballPower));
}
