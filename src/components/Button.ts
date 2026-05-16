import { html, component, type View, type Props } from '@/lib';

export type ButtonProps = Props<Partial<HTMLButtonElement>>;

export const Button = component<ButtonProps>((props: ButtonProps = {}): View => {
  return html`<button>${props.children ?? ''}</button>`;
});
