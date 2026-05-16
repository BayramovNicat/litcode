import { Card } from '../../components';
import { component, html } from '../../lib';
import { battleLog } from '../state';

export const BattleLog = component(() =>
  Card({
    className: 'grid gap-4',
    children: html`
      <div>
        <h2 class="text-xl font-bold text-slate-950 dark:text-white">Log</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Recent trainer events.</p>
      </div>
      <ol class="grid gap-2">
        ${battleLog.value.map(
          (message) => html`
            <li
              class="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              ${message}
            </li>
          `,
        )}
      </ol>
    `,
  }),
);
