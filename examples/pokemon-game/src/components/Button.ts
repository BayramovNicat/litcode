import { component, html } from '@/lib';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = {
  label: string;
  onclick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-red-500 text-white hover:bg-red-400 focus-visible:outline-red-400 disabled:bg-red-500/40',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline-slate-500 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white disabled:bg-slate-400',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-400 disabled:bg-rose-600/40',
  ghost:
    'bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white focus-visible:outline-slate-400 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-900 disabled:opacity-50',
};

export const Button = component<ButtonProps>(
  ({ label, onclick, variant = 'primary', disabled = false, className = '' }) => html`
    <button
      type="button"
      onclick=${onclick ?? (() => undefined)}
      disabled="${disabled ? 'true' : ''}"
      class="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed ${variants[
        variant
      ]} ${className}"
    >
      ${label}
    </button>
  `,
);
