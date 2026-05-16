import { component, html } from '../lib';

export type BadgeProps = {
  label: string;
  tone?: 'slate' | 'red' | 'green' | 'blue' | 'yellow' | 'violet';
};

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  slate:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  red: 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900',
  green:
    'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900',
  blue: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900',
  yellow:
    'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900',
  violet:
    'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-900',
};

export const Badge = component<BadgeProps>(
  ({ label, tone = 'slate' }) => html`
    <span
      class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ring-1 ${tones[tone]}"
    >
      ${label}
    </span>
  `,
);
