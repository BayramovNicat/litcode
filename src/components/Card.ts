import type { View } from '../lib';
import { component, html } from '../lib';

export type CardProps = {
  children: View;
  className?: string;
};

export const Card = component<CardProps>(
  ({ children, className = '' }) => html`
    <section
      class="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 ${className}"
    >
      ${children}
    </section>
  `,
);
