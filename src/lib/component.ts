import { toFragment } from './dom';
import { specialPropKeys, type Children, type Component, type TemplateResult, type View } from './types';

const specialPropKeySet = new Set([...specialPropKeys, 'className']);

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
  if (view.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return (view as DocumentFragment).firstElementChild;

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

  for (const [key, value] of Object.entries(props)) {
    if (specialPropKeySet.has(key)) continue;
    if (!(key in target)) continue;

    target[key] = value;
  }

  if (dataset) Object.assign(target.dataset, dataset);
  if (style) target.style.cssText = style;
}

export function component(render: () => View): Component;
export function component<Props extends object>(render: (props: Props) => View): Component<Props>;
export function component<Props extends object>(render: (props: Props) => View): Component<Props> {
  return ((props?: Props) => {
    const nextProps = (props ?? {}) as Props;
    const view = render(nextProps);
    const renderedView = isTemplateResult(view) ? toFragment(view) : view;
    const element = firstElement(renderedView);

    if (element) applyProps(element, nextProps);

    return renderedView;
  }) as Component<Props>;
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
