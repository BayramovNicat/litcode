import type { InventoryEntry, ItemId } from '@/game/types';

export function itemQuantity(inventory: InventoryEntry[], itemId: ItemId): number {
  return inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
}

export function consumeItem(inventory: InventoryEntry[], itemId: ItemId): InventoryEntry[] {
  return inventory.map((entry) =>
    entry.itemId === itemId ? { ...entry, quantity: Math.max(0, entry.quantity - 1) } : entry,
  );
}
