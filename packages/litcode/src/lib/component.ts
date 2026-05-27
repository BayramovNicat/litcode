import { toFragment } from './dom-api';
import {
  specialPropKeys,
  type Children,
  type Component,
  type TemplateResult,
  type View,
} from './types';
import { isRune, $effect } from './runes';

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

export function applyProps(element: Element, props: object): void {
  const target = element as HTMLElement & {
    dataset: DOMStringMap;
    style: CSSStyleDeclaration;
    [key: string]: unknown;
  };
  const { dataset, style } = props as {
    dataset?: Partial<DOMStringMap>;
    style?: string;
  };

  // Store the raw props on the element so we can transfer them during patching
  (target as any).__litcodeProps = props;

  const propCleanups = (target as any).__litcodePropCleanups ??= {};

  for (const key in props) {
    if (!hasOwn.call(props, key)) continue;
    if (specialPropKeySet.has(key)) continue;
    if (!(key in target)) continue;

    const rawValue = (props as Record<string, unknown>)[key];

    // Clean up any existing effect for this property
    if (propCleanups[key]) {
      propCleanups[key]();
      delete propCleanups[key];
    }

    const isRuneVal = isRune(rawValue);
    const isReactiveFn = !isRuneVal && typeof rawValue === 'function' && !(key.startsWith('on') || typeof target[key] === 'function');

    if (isRuneVal || isReactiveFn) {
      propCleanups[key] = $effect(() => {
        const resolvedValue = isRuneVal ? (rawValue as any).value : (rawValue as Function)();
        target[key] = resolvedValue;
      });
    } else {
      target[key] = rawValue;
    }
  }

  // Handle dataset
  if (dataset) {
    const datasetCleanups = (target as any).__litcodeDatasetCleanups ??= {};

    // Clean up any keys that are no longer present
    for (const key in datasetCleanups) {
      if (!(key in dataset)) {
        datasetCleanups[key]();
        delete datasetCleanups[key];
        delete target.dataset[key];
      }
    }

    for (const key in dataset) {
      if (!hasOwn.call(dataset, key)) continue;

      const rawValue = dataset[key];

      if (datasetCleanups[key]) {
        datasetCleanups[key]();
        delete datasetCleanups[key];
      }

      const isRuneVal = isRune(rawValue);
      const isReactiveFn = !isRuneVal && typeof rawValue === 'function';

      if (isRuneVal || isReactiveFn) {
        datasetCleanups[key] = $effect(() => {
          const resolvedValue = isRuneVal ? (rawValue as any).value : (rawValue as Function)();
          if (resolvedValue === null || resolvedValue === undefined) {
            delete target.dataset[key];
          } else {
            target.dataset[key] = String(resolvedValue);
          }
        });
      } else {
        if (rawValue === null || rawValue === undefined) {
          delete target.dataset[key];
        } else {
          target.dataset[key] = String(rawValue);
        }
      }
    }
  }

  // Handle style
  if (style !== undefined) {
    const styleCleanups = (target as any).__litcodeStyleCleanups ??= {};

    if (styleCleanups.style) {
      styleCleanups.style();
      delete styleCleanups.style;
    }

    const isRuneVal = isRune(style);
    const isReactiveFn = !isRuneVal && typeof style === 'function';

    if (isRuneVal || isReactiveFn) {
      styleCleanups.style = $effect(() => {
        const resolvedValue = isRuneVal ? (style as any).value : (style as Function)();
        target.style.cssText = resolvedValue ? String(resolvedValue) : '';
      });
    } else {
      target.style.cssText = style ? String(style) : '';
    }
  }
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
