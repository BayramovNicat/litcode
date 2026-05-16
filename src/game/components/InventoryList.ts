import { Button, Card } from '@/components';
import { component, html } from '@/lib';
import { getItem } from '@/game/data/items';
import { useItem } from '@/game/actions';
import { inventory } from '@/game/state';

export const InventoryList = component(() =>
  Card({
    className: 'grid gap-4',
    children: html`
      <div>
        <h2 class="text-xl font-bold text-slate-950 dark:text-white">Bag</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Use potions or throw balls during encounters.
        </p>
      </div>
      <div class="grid gap-3">
        ${inventory.value.map((entry) => {
          const item = getItem(entry.itemId);
          if (!item) return null;
          return html`
            <div
              class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div>
                <p class="font-semibold text-slate-950 dark:text-white">
                  ${item.name} × ${entry.quantity}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">${item.description}</p>
              </div>
              ${Button({
                label: 'Use',
                variant: 'ghost',
                disabled: entry.quantity <= 0,
                onclick: () => useItem(item.id),
              })}
            </div>
          `;
        })}
      </div>
    `,
  }),
);
