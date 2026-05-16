import { component, html } from '@/lib';

export type ProgressBarProps = {
  value: number;
  max: number;
  label?: string;
};

export const ProgressBar = component<ProgressBarProps>(({ value, max, label }) => {
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const color = percent > 50 ? 'bg-emerald-500' : percent > 25 ? 'bg-amber-400' : 'bg-rose-500';

  return html`
    <div class="grid gap-1.5">
      <div
        class="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400"
      >
        <span>${label ?? 'HP'}</span>
        <span>${value}/${max}</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div class="h-full rounded-full ${color}" style="width: ${percent}%"></div>
      </div>
    </div>
  `;
});
