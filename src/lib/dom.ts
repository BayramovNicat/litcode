import type { MountHandle, TemplateResult, View } from './types';

const markerPrefix = 'litcode-part-';

type TemplateCacheEntry = {
  template: HTMLTemplateElement;
};

type ChildPart = {
  kind: 'child';
  index: number;
  marker: Comment;
  nodes: Node[];
  instance?: TemplateInstance;
};

type AttributePart = {
  kind: 'attribute';
  index: number;
  element: Element;
  name: string;
  value?: unknown;
};

type EventPart = {
  kind: 'event';
  index: number;
  element: Element;
  name: string;
};

type KeyPart = {
  kind: 'key';
  index: number;
  element: LitcodeElement;
};

type Part = ChildPart | AttributePart | EventPart | KeyPart;

type TemplateInstance = {
  result: TemplateResult;
  fragment: DocumentFragment;
  parts: Part[];
  nodes: Node[];
};

type InstantiatedNodes = Node[] & {
  __litcodeInstance?: TemplateInstance;
};

type TemplateValue = View | EventListener;

type LitcodeElement = Element & {
  __litcodeEvents?: Record<string, EventListener | undefined>;
  __litcodeListeners?: Record<string, EventListener | undefined>;
  __litcodeKey?: string;
};

const booleanAttributes = new Set(['disabled', 'checked', 'selected', 'readonly', 'required']);
const templateCache = new Map<string, TemplateCacheEntry>();
const booleanSelector = Array.from(booleanAttributes, (attribute) => `[${attribute}=""]`).join(',');
let templateCacheDocument: Document | undefined;

function isNode(value: unknown): value is Node {
  return typeof Node !== 'undefined' && value instanceof Node;
}

function isTemplateResult(value: unknown): value is TemplateResult {
  return !!value && typeof value === 'object' && (value as TemplateResult).__litcodeTemplate === true;
}

function isFragment(value: unknown): value is DocumentFragment {
  return isNode(value) && value.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}

function normalize(view: View): Node[] {
  if (Array.isArray(view)) return view.flatMap((child) => normalize(child));
  if (view === null || view === undefined || view === false) return [];
  if (isTemplateResult(view)) {
    const instance = instantiateTemplate(view);
    const nodes = instance.nodes as InstantiatedNodes;
    nodes.__litcodeInstance = instance;
    return nodes;
  }
  if (isFragment(view)) {
    return Array.from(view.childNodes);
  }
  if (isNode(view)) return [view];
  return [document.createTextNode(String(view))];
}

function append(parent: Node, view: View) {
  normalize(view).forEach((node) => parent.appendChild(node));
}

function makeFragment(view: View): DocumentFragment {
  const fragment = document.createDocumentFragment();
  append(fragment, view);
  return fragment;
}

export function toFragment(view: View): DocumentFragment {
  return makeFragment(view);
}

function eventNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s(on[a-z][\w-]*)\s*=\s*["']?$/i);
  return match?.[1]?.slice(2).toLowerCase();
}

function attributeNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s([:@a-zA-Z_][\w:.-]*)\s*=\s*["']?$/);
  return match?.[1];
}

function markerAttributeValue(source: string, id: string): string {
  return /["']$/.test(source.trimEnd()) ? id : `"${id}"`;
}

function isInsideTag(source: string): boolean {
  return source.lastIndexOf('<') > source.lastIndexOf('>');
}

function escapeAttribute(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function setEvent(element: Element, name: string, handler: EventListener): void {
  const target = element as LitcodeElement;
  target.__litcodeEvents ??= {};
  target.__litcodeListeners ??= {};
  target.__litcodeEvents[name] = handler;

  if (target.__litcodeListeners[name]) return;

  const listener: EventListener = (event) => {
    target.__litcodeEvents?.[name]?.(event);
  };

  target.__litcodeListeners[name] = listener;
  element.addEventListener(name, listener);
}

function removeEvent(element: Element, name: string): void {
  const target = element as LitcodeElement;
  const listener = target.__litcodeListeners?.[name];

  if (listener) element.removeEventListener(name, listener);
  if (target.__litcodeEvents) delete target.__litcodeEvents[name];
  if (target.__litcodeListeners) delete target.__litcodeListeners[name];
}

function applyKeys(root: ParentNode): void {
  root.querySelectorAll('[key]').forEach((element) => {
    const key = element.getAttribute('key') ?? undefined;

    const target = element as LitcodeElement;
    target.__litcodeKey = key;
    element.removeAttribute('key');
  });
}

function setAttributeValue(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name);
    if (booleanAttributes.has(name) && name in element) {
      (element as unknown as Record<string, boolean>)[name] = false;
    }
    return;
  }

  const attributeValue = value === true && booleanAttributes.has(name) ? '' : String(value);
  element.setAttribute(name, attributeValue);

  if (booleanAttributes.has(name) && name in element) {
    (element as unknown as Record<string, boolean>)[name] = true;
  }
}

export function html(strings: TemplateStringsArray, ...values: TemplateValue[]): TemplateResult {
  return {
    __litcodeTemplate: true,
    strings,
    values,
  };
}

function createFragmentFromTemplate(strings: TemplateStringsArray, values: unknown[]): DocumentFragment {
  if (templateCacheDocument !== document) {
    templateCache.clear();
    templateCacheDocument = document;
  }

  let source = '';

  strings.forEach((part, index) => {
    source += part;
    if (index >= values.length) return;

    const value = values[index];
    const eventName = typeof value === 'function' ? eventNameFromAttribute(part) : undefined;

    if (eventName) {
      const id = `${markerPrefix}${index}`;
      source += markerAttributeValue(part, id);
      return;
    }

    const attributeName = isInsideTag(source) ? attributeNameFromAttribute(part) : undefined;

    if (attributeName === 'key') {
      const id = `${markerPrefix}${index}`;
      source += markerAttributeValue(part, id);
      return;
    }

    if (attributeName) {
      const id = `${markerPrefix}${index}`;
      source += markerAttributeValue(part, id);
      return;
    }

    if (isInsideTag(source)) {
      source += escapeAttribute(value);
      return;
    }

    source += `<!--${markerPrefix}${index}-->`;
  });

  const cacheKey = source.trim();
  let cached = templateCache.get(cacheKey);

  if (!cached) {
    const template = document.createElement('template');
    template.innerHTML = cacheKey;
    cached = {
      template,
    };
    templateCache.set(cacheKey, cached);
  }

  const fragment = cached.template.content.cloneNode(true) as DocumentFragment;

  fragment.querySelectorAll(booleanSelector).forEach((element) => {
    booleanAttributes.forEach((attribute) => {
      if (element.getAttribute(attribute) !== '') return;

      if (attribute in element) {
        (element as unknown as Record<string, boolean>)[attribute] = true;
      }

      element.removeAttribute(attribute);
    });
  });

  applyKeys(fragment);

  return fragment;
}

function instantiateTemplate(result: TemplateResult): TemplateInstance {
  const fragment = createFragmentFromTemplate(result.strings, result.values);
  const nodes = Array.from(fragment.childNodes);
  const parts: Part[] = [];
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];

  while (walker.nextNode()) comments.push(walker.currentNode as Comment);

  comments.forEach((comment) => {
    const data = comment.data.trim();
    if (!data.startsWith(markerPrefix)) return;

    const index = Number(data.slice(markerPrefix.length));
    const part: ChildPart = { kind: 'child', index, marker: comment, nodes: [] };
    (comment as Comment & { __litcodePart?: ChildPart }).__litcodePart = part;
    parts.push(part);
  });

  result.values.forEach((value, index) => {
    const previous = result.strings[index];
    const eventName = typeof value === 'function' ? eventNameFromAttribute(previous) : undefined;
    const attributeName = isInsideTag(previous) ? attributeNameFromAttribute(previous) : undefined;

    if (eventName) {
      fragment.querySelectorAll(`[on${eventName}="${markerPrefix}${index}"]`).forEach((element) => {
        parts.push({ kind: 'event', index, element, name: eventName });
      });
      return;
    }

    if (attributeName === 'key') {
      fragment.querySelectorAll(`[key="${markerPrefix}${index}"]`).forEach((element) => {
        parts.push({ kind: 'key', index, element: element as LitcodeElement });
      });
      return;
    }

    if (attributeName) {
      fragment.querySelectorAll(`[${attributeName}="${markerPrefix}${index}"]`).forEach((element) => {
        parts.push({ kind: 'attribute', index, element, name: attributeName });
      });
    }
  });

  const instance = { result, fragment, parts, nodes };
  updateTemplateInstance(instance, result);
  return instance;
}

function findChildPartBefore(nodes: Node[], fallbackParent: Node): ChildPart | undefined {
  const first = nodes[0];
  const previous = first ? first.previousSibling : fallbackParent.lastChild;
  return previous instanceof Comment && (previous as Comment & { __litcodePart?: ChildPart }).__litcodePart
    ? (previous as Comment & { __litcodePart?: ChildPart }).__litcodePart
    : undefined;
}

function updateChildPart(part: ChildPart, value: unknown): void {
  if (part.instance && isTemplateResult(value) && part.instance.result.strings === value.strings) {
    updateTemplateInstance(part.instance, value);
    part.nodes = part.instance.nodes;
    return;
  }

  const nodes = normalize(value as View);
  const parent = part.marker.parentNode;
  if (!parent) return;

  part.nodes = patchChildPartNodes(parent, part.nodes, nodes, part.marker);
  part.instance = isTemplateResult(value)
    ? ((nodes as InstantiatedNodes).__litcodeInstance ?? findChildPartBefore(nodes, parent)?.instance)
    : undefined;
}

function patchChildPartNodes(
  parent: Node,
  currentNodes: Node[],
  nextNodes: Node[],
  marker: Comment,
): Node[] {
  const patchedNodes: Node[] = [];
  const length = Math.max(currentNodes.length, nextNodes.length);

  for (let index = 0; index < length; index++) {
    const current = currentNodes[index];
    const next = nextNodes[index];

    if (!current && next) {
      parent.insertBefore(next, marker);
      patchedNodes.push(next);
      continue;
    }

    if (current && !next) {
      current.parentNode?.removeChild(current);
      continue;
    }

    if (current && next) {
      patchedNodes.push(patchNode(current, next));
    }
  }

  return patchedNodes;
}

function updateTemplateInstance(instance: TemplateInstance, next: TemplateResult): void {
  instance.parts.forEach((part) => {
    const value = next.values[part.index];

    if (part.kind === 'child') {
      updateChildPart(part, value);
      return;
    }

    if (part.kind === 'attribute') {
      if (!Object.is(part.value, value)) {
        setAttributeValue(part.element, part.name, value);
        part.value = value;
      }
      return;
    }

    if (part.kind === 'event') {
      if (typeof value === 'function') setEvent(part.element, part.name, value as EventListener);
      return;
    }

    part.element.__litcodeKey = String(value);
    part.element.removeAttribute('key');
  });

  instance.result = next;
}

function sameNodeType(current: Node, next: Node): boolean {
  if (current.nodeType !== next.nodeType) return false;

  if (current instanceof Element && next instanceof Element) {
    if (
      current instanceof HTMLInputElement &&
      next instanceof HTMLInputElement &&
      current.type !== next.type
    ) {
      return false;
    }

    return current.tagName === next.tagName;
  }

  return true;
}

function patchText(current: Node, next: Node): void {
  if (current.textContent !== next.textContent) {
    current.textContent = next.textContent;
  }
}

function patchAttributes(current: Element, next: Element): void {
  const currentAttributes = current.attributes;
  const nextAttributes = next.attributes;

  if (currentAttributes.length === 0 && nextAttributes.length === 0) return;

  for (let index = currentAttributes.length - 1; index >= 0; index--) {
    const { name } = currentAttributes[index];
    if (!next.hasAttribute(name)) current.removeAttribute(name);
  }

  for (let index = 0; index < nextAttributes.length; index++) {
    const { name, value } = nextAttributes[index];
    if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  }
}

function patchEvents(current: Element, next: Element): void {
  const currentElement = current as LitcodeElement;
  const nextElement = next as LitcodeElement;

  if (!currentElement.__litcodeEvents && !nextElement.__litcodeEvents) return;

  const currentEvents = currentElement.__litcodeEvents ?? {};
  const nextEvents = nextElement.__litcodeEvents ?? {};

  Object.keys(currentEvents).forEach((name) => {
    if (!nextEvents[name]) removeEvent(current, name);
  });

  Object.entries(nextEvents).forEach(([name, handler]) => {
    if (handler) setEvent(current, name, handler);
  });
}

function patchInput(current: HTMLInputElement, next: HTMLInputElement): void {
  if (current.value !== next.value) current.value = next.value;
  if (current.checked !== next.checked) current.checked = next.checked;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
  if (current.readOnly !== next.readOnly) current.readOnly = next.readOnly;
  if (current.required !== next.required) current.required = next.required;
}

function patchOption(current: HTMLOptionElement, next: HTMLOptionElement): void {
  if (current.selected !== next.selected) current.selected = next.selected;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
}

function patchSelect(current: HTMLSelectElement, next: HTMLSelectElement): void {
  const nextValue = next.getAttribute('value') ?? next.value;
  if (current.value !== nextValue) current.value = nextValue;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
  if (current.required !== next.required) current.required = next.required;
}

function patchTextarea(current: HTMLTextAreaElement, next: HTMLTextAreaElement): void {
  if (current.value !== next.value) current.value = next.value;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
  if (current.readOnly !== next.readOnly) current.readOnly = next.readOnly;
  if (current.required !== next.required) current.required = next.required;
}

function patchFormProperties(current: Element, next: Element): void {
  switch (current.tagName) {
    case 'INPUT':
      patchInput(current as HTMLInputElement, next as HTMLInputElement);
      return;
    case 'TEXTAREA':
      patchTextarea(current as HTMLTextAreaElement, next as HTMLTextAreaElement);
      return;
    case 'SELECT':
      patchSelect(current as HTMLSelectElement, next as HTMLSelectElement);
      return;
    case 'OPTION':
      patchOption(current as HTMLOptionElement, next as HTMLOptionElement);
  }
}

function patchElementTextChildren(current: Element, next: Element): boolean {
  const currentText = current.firstChild;
  const nextText = next.firstChild;

  if (
    currentText?.nodeType === Node.TEXT_NODE &&
    nextText?.nodeType === Node.TEXT_NODE &&
    currentText.nextSibling === null &&
    nextText.nextSibling === null
  ) {
    patchText(currentText, nextText);
    return true;
  }

  return false;
}

function getNodeKey(node: Node): string | undefined {
  return node instanceof Element ? (node as LitcodeElement).__litcodeKey : undefined;
}

function hasKeyedChildren(children: Node[]): boolean {
  for (let index = 0; index < children.length; index++) {
    if (getNodeKey(children[index]) !== undefined) return true;
  }

  return false;
}

function hasAllKeys(children: Node[]): boolean {
  for (let index = 0; index < children.length; index++) {
    if (getNodeKey(children[index]) === undefined) return false;
  }

  return children.length > 0;
}

function patchChildrenByIndex(parent: Node, nextChildren: Node[]): void {
  const currentChildren = parent.childNodes;
  const currentLength = currentChildren.length;
  const nextLength = nextChildren.length;
  const commonLength = Math.min(currentLength, nextLength);

  for (let index = 0; index < commonLength; index++) {
    const current = currentChildren[index];
    const next = nextChildren[index];

    patchNode(current, next);
  }

  for (let index = commonLength; index < nextLength; index++) {
    parent.appendChild(nextChildren[index]);
  }

  for (let index = currentLength - 1; index >= nextLength; index--) {
    parent.childNodes[index]?.remove();
  }
}

function patchKeyedChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = Array.from(parent.childNodes);
  const keyedCurrent = new Map<string, Node>();
  const unkeyedCurrent: Node[] = [];

  for (let index = 0; index < currentChildren.length; index++) {
    const child = currentChildren[index];
    const key = getNodeKey(child);
    if (key === undefined) {
      unkeyedCurrent.push(child);
      continue;
    }

    if (!keyedCurrent.has(key)) keyedCurrent.set(key, child);
  }

  const usedCurrent = new Set<Node>();
  let unkeyedIndex = 0;

  for (let index = 0; index < nextChildren.length; index++) {
    const next = nextChildren[index];
    const key = getNodeKey(next);
    let current: Node | undefined;

    if (key !== undefined) {
      current = keyedCurrent.get(key);
    } else {
      while (unkeyedIndex < unkeyedCurrent.length && usedCurrent.has(unkeyedCurrent[unkeyedIndex])) {
        unkeyedIndex++;
      }
      current = unkeyedCurrent[unkeyedIndex++];
    }

    const reference = parent.childNodes[index] ?? null;

    if (!current) {
      parent.insertBefore(next, reference);
      continue;
    }

    usedCurrent.add(current);
    const patched = patchNode(current, next);
    if (patched !== reference) parent.insertBefore(patched, reference);
  }

  for (let index = 0; index < currentChildren.length; index++) {
    const child = currentChildren[index];
    if (!usedCurrent.has(child) && child.parentNode === parent) child.remove();
  }
}

function patchFullyKeyedChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = Array.from(parent.childNodes);
  const keyedCurrent = new Map<string, Node>();
  const nextKeys = new Set<string>();

  for (let index = 0; index < currentChildren.length; index++) {
    const child = currentChildren[index];
    const key = getNodeKey(child);
    if (key !== undefined && !keyedCurrent.has(key)) keyedCurrent.set(key, child);
  }

  for (let index = 0; index < nextChildren.length; index++) {
    const next = nextChildren[index];
    const key = getNodeKey(next);
    if (key !== undefined) nextKeys.add(key);
    const current = key === undefined ? undefined : keyedCurrent.get(key);
    const patched = current ? patchNode(current, next) : next;
    const reference = parent.childNodes[index] ?? null;

    if (patched !== reference) parent.insertBefore(patched, reference);
  }

  for (let index = currentChildren.length - 1; index >= 0; index--) {
    const child = currentChildren[index];
    const key = getNodeKey(child);
    if ((key === undefined || !nextKeys.has(key)) && child.parentNode === parent) {
      child.remove();
    }
  }
}

function patchChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = Array.from(parent.childNodes);

  if (currentChildren.length === 0) {
    parent.append(...nextChildren);
    return;
  }

  if (nextChildren.length === 0) {
    parent.textContent = '';
    return;
  }

  if (hasKeyedChildren(currentChildren) || hasKeyedChildren(nextChildren)) {
    if (currentChildren.length > 16 && currentChildren.length === nextChildren.length && hasAllKeys(currentChildren) && hasAllKeys(nextChildren)) {
      patchFullyKeyedChildren(parent, nextChildren);
      return;
    }

    patchKeyedChildren(parent, nextChildren);
    return;
  }

  patchChildrenByIndex(parent, nextChildren);
}

function patchElement(current: Element, next: Element): void {
  (current as LitcodeElement).__litcodeKey = (next as LitcodeElement).__litcodeKey;
  patchAttributes(current, next);
  patchEvents(current, next);
  if (!patchElementTextChildren(current, next)) patchChildren(current, Array.from(next.childNodes));
  patchFormProperties(current, next);
}

function patchNode(current: Node, next: Node): Node {
  if (!sameNodeType(current, next)) {
    current.parentNode?.replaceChild(next, current);
    return next;
  }

  if (current.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
    patchText(current, next);
    return current;
  }

  if (current instanceof Element && next instanceof Element) {
    patchElement(current, next);
  }

  return current;
}

export function render(view: View, target: ParentNode): MountHandle {
  const parent = target as unknown as HTMLElement;
  let rootInstance = isTemplateResult(view) ? instantiateTemplate(view) : undefined;
  parent.replaceChildren(rootInstance ? rootInstance.fragment : makeFragment(view));

  return {
    update(next) {
      if (
        rootInstance &&
        isTemplateResult(next) &&
        rootInstance.result.strings === next.strings
      ) {
        updateTemplateInstance(rootInstance, next);
        return;
      }

      if (isTemplateResult(next)) {
        const nextInstance = instantiateTemplate(next);
        patchChildren(parent, nextInstance.nodes);
        rootInstance = nextInstance;
        return;
      }

      patchChildren(parent, Array.from(makeFragment(next).childNodes));
      rootInstance = undefined;
    },
    destroy() {
      parent.replaceChildren();
      rootInstance = undefined;
    },
  };
}

export function mount(view: View, target: ParentNode): MountHandle {
  return render(view, target);
}
