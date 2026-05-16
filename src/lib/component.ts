import type { Children, Component, View } from './types';

export function component<Props extends object>(render: Component<Props>): Component<Props> {
  return render;
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
