import type { Children, Component, View } from './types';

export function component(render: () => View): Component;
export function component<Props extends object>(render: (props: Props) => View): Component<Props>;
export function component<Props extends object>(render: (props: Props) => View): Component<Props> {
  return ((props?: Props) => render((props ?? {}) as Props)) as Component<Props>;
}

export function createElement<Props extends object>(
  Component: Component<Props>,
  props: Props,
): View;
export function createElement<Props extends object>(
  Component: Component<Props>,
  props: Props,
  children: Children,
): View;
export function createElement<Props extends object>(
  Component: Component<Props & { children?: Children }>,
  props: Props,
  children?: Children,
): View {
  return Component(children === undefined ? props : { ...props, children });
}
