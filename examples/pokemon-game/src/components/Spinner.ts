import { component, html } from '@/lib';

export const Spinner = component(
  () => html`
    <div
      class="inline-flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400"
    >
      <span
        class="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent"
      ></span>
      Loading Gen 1 Pokémon...
    </div>
  `,
);
