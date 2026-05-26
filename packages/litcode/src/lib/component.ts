import { toFragment } from './dom-api';
import {
  specialPropKeys,
  type Children,
  type Component,
  type TemplateResult,
  type View,
} from './types';

const specialPropKeySet = new Set([...specialPropKeys, 'className']);
const hasOwn = Object.prototype.hasOwnProperty;

function isTemplateResult(view: View): view is TemplateResult {
  return !!view && typeof view === 'object' && '__litcodeTemplate' in view;
}

function firstElement(view: View): Element | null {
  if (Array.isArray(view)) {
    for (const child of view) {
      const element = firstElement(child);
      if (element) return element;
    }

    return null;
  }

  if (isTemplateResult(view)) {
    return firstElement(toFragment(view));
  }

  if (!(view instanceof Node)) return null;
  if (view instanceof Element) return view;
  if (view.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
    return (view as DocumentFragment).firstElementChild;

  return null;
}

function applyProps(element: Element, props: object): void {
  const target = element as HTMLElement & {
    dataset: DOMStringMap;
    style: CSSStyleDeclaration;
    [key: string]: unknown;
  };
  const { dataset, style } = props as {
    dataset?: Partial<DOMStringMap>;
    style?: string;
  };

  for (const key in props) {
    if (!hasOwn.call(props, key)) continue;
    if (specialPropKeySet.has(key)) continue;
    if (!(key in target)) continue;

    target[key] = (props as Record<string, unknown>)[key];
  }

  if (dataset) Object.assign(target.dataset, dataset);
  if (style) target.style.cssText = style;
}

function hasRootProps(props: object): boolean {
  for (const key in props) {
    if (hasOwn.call(props, key) && key !== 'children' && key !== 'className') return true;
  }

  return false;
}

/**
 * Wraps a render function so it can receive DOM-like props and children.
 *
 * The returned component renders a `View`, then applies any root props
 * such as DOM properties, `dataset`, and `style` to the first rendered element.
 */
export function component(render: () => View): Component;
/**
 * Wraps a render function so it can receive typed props and children.
 *
 * The returned component renders a `View`, then applies any root props
 * such as DOM properties, `dataset`, and `style` to the first rendered element.
 */
export function component<Props extends object>(render: (props: Props) => View): Component<Props>;
/**
 * Wraps a render function so it can receive typed props and children.
 *
 * The returned component renders a `View`, then applies any root props
 * such as DOM properties, `dataset`, and `style` to the first rendered element.
 */
export function component<Props extends object>(render: (props: Props) => View): Component<Props> {
  return ((props?: Props) => {
    const nextProps = (props ?? {}) as Props;
    const view = render(nextProps);

    if (!hasRootProps(nextProps)) return view;

    const renderedView = isTemplateResult(view) ? toFragment(view) : view;
    const element = firstElement(renderedView);

    if (element) applyProps(element, nextProps);

    return renderedView;
  }) as Component<Props>;
}

/**
 * Invokes a component with props and optional children.
 *
 * This is useful when you want the component call site to read like a JSX
 * element while staying in plain TypeScript.
 */
export function createElement<Props extends object>(
  Component: Component<Props>,
  props: Props,
): View;
/**
 * Invokes a component with props and optional children.
 *
 * This is useful when you want the component call site to read like a JSX
 * element while staying in plain TypeScript.
 */
export function createElement<Props extends object>(
  Component: Component<Props>,
  props: Props,
  children: Children,
): View;
/**
 * Invokes a component with props and optional children.
 *
 * This is useful when you want the component call site to read like a JSX
 * element while staying in plain TypeScript.
 */
export function createElement<Props extends object>(
  Component: Component<Props & { children?: Children }>,
  props: Props,
  children?: Children,
): View {
  return Component(children === undefined ? props : { ...props, children });
}
