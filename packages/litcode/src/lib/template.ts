import type { View, RepeatResult, TemplateResult } from './types';
import type { Rune } from './runes';

export type TemplateCacheEntry = {
  template: HTMLTemplateElement;
  hasBooleanAttributes: boolean;
  hasKeys: boolean;
  dynamicParts?: StaticPart[];
};

export type StaticPart =
  | { kind: 'child'; index: number; path: number[] }
  | { kind: 'attribute'; index: number; path: number[]; name: string }
  | { kind: 'event'; index: number; path: number[]; name: string }
  | { kind: 'key'; index: number; path: number[] };

export type ChildPart = {
  kind: 'child';
  index: number;
  marker: Comment;
  nodes: Node[];
  instance?: TemplateInstance;
  array?: TemplateArrayState;
  repeat?: RepeatState;
  cleanup?: () => void;
  source?: unknown;
};

export type TemplateArrayState = {
  instances: TemplateInstance[];
};

export type RepeatBlock = {
  key: string;
  item: unknown;
  index: number;
  nodes: Node[];
  instance?: TemplateInstance;
  cleanup?: () => void;
};

export type RepeatState = {
  blocks: RepeatBlock[];
};

export type AttributePart = {
  kind: 'attribute';
  index: number;
  element: Element;
  name: string;
  value?: unknown;
  cleanup?: () => void;
  source?: unknown;
};

export type EventPart = {
  kind: 'event';
  index: number;
  element: Element;
  name: string;
  value?: EventListener;
  listener?: EventListener;
  cleanup?: () => void;
  source?: unknown;
};

export type KeyPart = {
  kind: 'key';
  index: number;
  element: LitcodeElement;
  cleanup?: () => void;
  source?: unknown;
};

export type Part = ChildPart | AttributePart | EventPart | KeyPart;

export type TemplateInstance = {
  result: TemplateResult;
  fragment: DocumentFragment;
  parts: Part[];
  nodes: Node[];
};

export type InstantiatedNodes = Node[] & {
  __litcodeInstance?: TemplateInstance;
};

export type ReactiveValue<T = unknown> = Rune<T> | (() => T);
export type TemplateValue = View | EventListener | ReactiveValue<View>;

export type LitcodeElement = Element & {
  __litcodeEvents?: Record<string, EventListener | undefined>;
  __litcodeListeners?: Record<string, EventListener | undefined>;
  __litcodeKey?: string;
};

export const booleanAttributeNames = [
  'disabled',
  'checked',
  'selected',
  'readonly',
  'required',
] as const;
export const booleanAttributes = new Set<string>(booleanAttributeNames);
export const templateCache = new Map<string, TemplateCacheEntry>();
export const booleanSelector = booleanAttributeNames
  .map((attribute) => `[${attribute}=""]`)
  .join(',');
export const keySelector = '[key]';
export const markerPrefix = 'litcode-part-';

/**
 * Creates a Litcode template from a tagged template literal.
 *
 * Dynamic values may be DOM nodes, nested templates, lists, booleans,
 * strings, numbers, or reactive values.
 */
export function html(strings: TemplateStringsArray, ...values: TemplateValue[]): TemplateResult {
  return {
    __litcodeTemplate: true,
    strings,
    values,
  };
}

/**
 * Creates a keyed repeat block for rendering ordered lists.
 *
 * Keys are used to preserve and move DOM nodes during reordering.
 */
export function repeat<Item>(
  items: readonly Item[],
  key: (item: Item, index: number) => string | number,
  render: (item: Item, index: number) => View,
): RepeatResult<Item> {
  return {
    __litcodeRepeat: true,
    items,
    key,
    render,
  };
}
