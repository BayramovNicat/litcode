import { getItem } from '@/game/data/items';
import { getLocation } from '@/game/data/locations';
import {
  applyDamage,
  calculateDamage,
  catchChance,
  createBattlePokemon,
  expReward,
  expToNextLevel,
  healPokemon,
} from '@/game/logic/battle';
import { consumeItem, itemQuantity } from '@/game/logic/inventory';
import { findWildPokemon } from '@/game/logic/location';
import {
  activePokemon,
  allPokemon,
  currentLocationId,
  hasStarter,
  inventory,
  log,
  party,
  trainerName,
  wildPokemon,
} from '@/game/state';
import type { BattlePokemon, ItemId, LocationId, Pokemon, PokemonMove, StarterId } from '@/game/types';

function hasAvailablePokemon(): boolean {
  return party.value.some((pokemon) => pokemon.currentHp > 0);
}

function learnMoves(pokemon: BattlePokemon): BattlePokemon {
  const known = new Set(pokemon.moves.map((move) => move.name));
  let moves = [...pokemon.moves];

  pokemon.learnset
    .filter((move) => move.level <= pokemon.level && !known.has(move.name))
    .forEach(({ level: _, ...move }) => {
      moves = [...moves, move].slice(-4);
      known.add(move.name);
      log(`${pokemon.name} learned ${move.name}!`);
    });

  return { ...pokemon, moves };
}

function scaleEvolvedStats(evolution: Pokemon, current: BattlePokemon): BattlePokemon {
  const hpGain = Math.max(0, evolution.hp - current.hp);
  return {
    ...current,
    id: evolution.id,
    name: evolution.name,
    sprite: evolution.sprite,
    types: evolution.types,
    hp: evolution.hp,
    attack: evolution.attack,
    defense: evolution.defense,
    speed: evolution.speed,
    learnset: evolution.learnset,
    evolution: evolution.evolution,
    maxHp: current.maxHp + hpGain,
    currentHp: current.currentHp + hpGain,
  };
}

function evolveIfReady(pokemon: BattlePokemon): BattlePokemon {
  if (!pokemon.evolution || pokemon.level < pokemon.evolution.level) return pokemon;

  const evolution = allPokemon.value.find((candidate) => candidate.id === pokemon.evolution?.id);
  if (!evolution) return pokemon;

  log(`${pokemon.name} evolved into ${evolution.name}!`);
  return learnMoves(scaleEvolvedStats(evolution, pokemon));
}

function gainExperience(pokemon: BattlePokemon, amount: number): BattlePokemon {
  let updated = { ...pokemon, exp: pokemon.exp + amount };
  log(`${pokemon.name} gained ${amount} EXP.`);

  while (updated.exp >= updated.expToNextLevel) {
    updated = {
      ...updated,
      exp: updated.exp - updated.expToNextLevel,
      level: updated.level + 1,
      expToNextLevel: expToNextLevel(updated.level + 1),
      maxHp: updated.maxHp + 3,
      currentHp: updated.currentHp + 3,
      attack: updated.attack + 2,
      defense: updated.defense + 2,
      speed: updated.speed + 1,
    };
    log(`${updated.name} grew to level ${updated.level}!`);
    updated = evolveIfReady(learnMoves(updated));
  }

  return updated;
}

export function updateTrainerName(value: string): void {
  trainerName.value = value;
}

export function chooseStarter(starterId: StarterId): void {
  const starter = allPokemon.value.find((pokemon) => pokemon.id === starterId);
  if (!starter) return;

  party.value = [createBattlePokemon(starter)];
  hasStarter.value = true;
  log(`${trainerName.value || 'Trainer'} chose ${starter.name}!`);
}

export function travelTo(locationId: LocationId): void {
  currentLocationId.value = locationId;
  wildPokemon.value = null;
  log(`Traveled to ${getLocation(locationId).name}.`);
}

export function healAtPokemonCenter(): void {
  if (party.value.length === 0) {
    log('You have no Pokémon to heal yet.');
    return;
  }

  party.value = party.value.map((pokemon) => ({ ...pokemon, currentHp: pokemon.maxHp }));
  wildPokemon.value = null;
  log('Pokémon Center healed your party to full health.');
}

export function searchForPokemon(): void {
  const player = activePokemon.value;
  if (!player || player.currentHp <= 0) {
    log('Your active Pokémon has fainted. Heal it before starting a fight.');
    return;
  }

  const location = getLocation(currentLocationId.value);
  if (Math.random() > location.encounterRate) {
    log(`You searched ${location.name}, but nothing appeared.`);
    return;
  }

  const found = findWildPokemon(allPokemon.value, currentLocationId.value);
  if (!found) {
    log('No Pokémon could be found here yet.');
    return;
  }

  wildPokemon.value = found;
  log(`A wild ${found.name} appeared!`);
}

export function attackWildPokemon(move?: PokemonMove): void {
  const player = activePokemon.value;
  const wild = wildPokemon.value;
  if (!player || !wild) return;
  if (player.currentHp <= 0) {
    log(`${player.name} has fainted and cannot attack. Use a potion first.`);
    return;
  }

  const selectedMove = move ?? player.moves[0];
  const playerDamage = calculateDamage(player, wild, selectedMove);
  const damagedWild = applyDamage(wild, playerDamage);
  wildPokemon.value = damagedWild;
  log(`${player.name} used ${selectedMove.name} and dealt ${playerDamage} damage to ${wild.name}.`);

  if (damagedWild.currentHp <= 0) {
    wildPokemon.value = null;
    log(`Wild ${wild.name} fainted.`);
    party.value = [gainExperience(player, expReward(wild)), ...party.value.slice(1)];
    return;
  }

  const wildMove = damagedWild.moves[Math.floor(Math.random() * damagedWild.moves.length)];
  const wildDamage = calculateDamage(damagedWild, player, wildMove);
  const damagedPlayer = applyDamage(player, wildDamage);
  party.value = [damagedPlayer, ...party.value.slice(1)];
  log(`${damagedWild.name} used ${wildMove.name} for ${wildDamage} damage.`);

  if (damagedPlayer.currentHp <= 0) {
    if (!hasAvailablePokemon()) {
      wildPokemon.value = null;
      log(`${damagedPlayer.name} fainted. You have no Pokémon left. The battle ended.`);
      return;
    }

    log(`${damagedPlayer.name} fainted. Choose another Pokémon to continue the battle.`);
  }
}

export function switchActivePokemon(index: number): void {
  const selected = party.value[index];
  if (!selected) return;

  if (selected.currentHp <= 0) {
    log(`${selected.name} has fainted and cannot battle.`);
    return;
  }

  if (index === 0) return;

  party.value = [selected, ...party.value.slice(0, index), ...party.value.slice(index + 1)];
  log(`${selected.name}, I choose you!`);
}

export function useItem(itemId: ItemId): void {
  const item = getItem(itemId);
  if (!item || itemQuantity(inventory.value, itemId) <= 0) {
    log(`No ${item?.name ?? 'item'} left.`);
    return;
  }

  if (item.kind === 'heal') {
    const player = activePokemon.value;
    if (!player) return;
    party.value = [healPokemon(player, item.power), ...party.value.slice(1)];
    inventory.value = consumeItem(inventory.value, itemId);
    log(`${item.name} restored ${item.power} HP to ${player.name}.`);
    return;
  }

  const wild = wildPokemon.value;
  if (!wild) {
    log('There is no wild Pokémon to catch.');
    return;
  }

  const player = activePokemon.value;
  if (!player || player.currentHp <= 0) {
    log('Choose an available Pokémon before using a Poké Ball.');
    return;
  }

  inventory.value = consumeItem(inventory.value, itemId);
  const chance = catchChance(wild, item.power);
  if (Math.random() <= chance) {
    party.value = [...party.value, { ...wild, currentHp: wild.maxHp, exp: 0 }];
    wildPokemon.value = null;
    log(`${item.name} worked! ${wild.name} joined your party.`);
    return;
  }

  log(`${wild.name} broke free from the ${item.name}.`);
}

export function runFromBattle(): void {
  if (!wildPokemon.value) return;
  log(`Ran away from ${wildPokemon.value.name}.`);
  wildPokemon.value = null;
}
