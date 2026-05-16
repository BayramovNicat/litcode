import type { View, RepeatResult, TemplateResult } from './types';

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
  repeat?: RepeatState;
};

export type RepeatBlock = {
  key: string;
  item: unknown;
  index: number;
  nodes: Node[];
  instance?: TemplateInstance;
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
};

export type EventPart = {
  kind: 'event';
  index: number;
  element: Element;
  name: string;
};

export type KeyPart = {
  kind: 'key';
  index: number;
  element: LitcodeElement;
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

export type TemplateValue = View | EventListener;

export type LitcodeElement = Element & {
  __litcodeEvents?: Record<string, EventListener | undefined>;
  __litcodeListeners?: Record<string, EventListener | undefined>;
  __litcodeKey?: string;
};

export const booleanAttributes = new Set(['disabled', 'checked', 'selected', 'readonly', 'required']);
export const templateCache = new Map<string, TemplateCacheEntry>();
export const booleanSelector = Array.from(booleanAttributes, (attribute) => `[${attribute}=""]`).join(',');
export const keySelector = '[key]';
export const markerPrefix = 'litcode-part-';

export function html(strings: TemplateStringsArray, ...values: TemplateValue[]): TemplateResult {
  return {
    __litcodeTemplate: true,
    strings,
    values,
  };
}

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
