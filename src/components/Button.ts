import { html, component, type Props } from '@/lib';

export type ButtonProps = Props<Partial<HTMLButtonElement>>;

export const Button = component<ButtonProps>((props: ButtonProps = {}) => {
  const { children, ...rest } = props;
  const elm = html`<button>${props.children ?? ''}</button> `;

  Object.assign(elm.firstElementChild as HTMLButtonElement, rest);
  return elm;
});
