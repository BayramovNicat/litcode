import { component, html } from '../lib';

export type InputProps = {
  value: string;
  placeholder?: string;
  label?: string;
  oninput?: (value: string) => void;
};

export const Input = component<InputProps>(
  ({ value, placeholder = '', label, oninput }) => html`
    <label class="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
      ${label ? html`<span>${label}</span>` : null}
      <input
        value="${value}"
        placeholder="${placeholder}"
        oninput=${(event: Event) => oninput?.((event.target as HTMLInputElement).value)}
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-4 focus:ring-red-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-red-400"
      />
    </label>
  `,
);
