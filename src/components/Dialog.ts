import { toFragment } from '@/lib/dom-api';
import { cn, component, html, type Props, type View } from '@/lib';

export type DialogProps = Props<Partial<HTMLDialogElement>>;

const RawDialog = component<Omit<DialogProps, 'open'>>(
  ({ children, className }: Omit<DialogProps, 'open'> = {}): View => {
    return html`<dialog
      class="${cn(
        'fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/80 backdrop:backdrop-blur-sm',
        className,
      )}"
      onclick="${(event) => {
        if (event.target === event.currentTarget)
          (event.currentTarget as HTMLDialogElement).close();
      }}"
    >
      ${children ?? ''}
    </dialog>`;
  },
);

export function Dialog({ open, ...props }: DialogProps = {}): View {
  if (!open) return '';

  const fragment = toFragment(RawDialog(props));
  const dialog = fragment.firstElementChild as HTMLDialogElement | null;

  if (!dialog) return '';

  queueMicrotask(() => {
    if (dialog.isConnected && !dialog.open) dialog.showModal();
  });

  return dialog;
}
