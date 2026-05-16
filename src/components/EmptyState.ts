import { component, html } from '../lib';

export type EmptyStateProps = {
  title: string;
  message: string;
};

export const EmptyState = component<EmptyStateProps>(
  ({ title, message }) => html`
    <div
      class="rounded-2xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700"
    >
      <h3 class="font-semibold text-slate-900 dark:text-slate-50">${title}</h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">${message}</p>
    </div>
  `,
);
