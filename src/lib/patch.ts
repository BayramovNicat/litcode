import { type LitcodeElement } from './template';

const hasOwn = Object.prototype.hasOwnProperty;

export function sameNodeType(current: Node, next: Node): boolean {
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

export function patchText(current: Node, next: Node): void {
  if (current.textContent !== next.textContent) {
    current.textContent = next.textContent;
  }
}

export function patchAttributes(current: Element, next: Element): void {
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

export function patchEvents(current: Element, next: Element): void {
  const currentElement = current as LitcodeElement;
  const nextElement = next as LitcodeElement;

  if (!currentElement.__litcodeEvents && !nextElement.__litcodeEvents) return;

  const currentEvents = currentElement.__litcodeEvents ?? {};
  const nextEvents = nextElement.__litcodeEvents ?? {};

  for (const name in currentEvents) {
    if (!hasOwn.call(currentEvents, name)) continue;
    if (!nextEvents[name]) removeEvent(current, name);
  }

  for (const name in nextEvents) {
    if (!hasOwn.call(nextEvents, name)) continue;
    const handler = nextEvents[name];
    if (handler) setEvent(current, name, handler);
  }
}

export function setEvent(element: Element, name: string, handler: EventListener): void {
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

export function removeEvent(element: Element, name: string): void {
  const target = element as LitcodeElement;
  const listener = target.__litcodeListeners?.[name];

  if (listener) element.removeEventListener(name, listener);
  if (target.__litcodeEvents) delete target.__litcodeEvents[name];
  if (target.__litcodeListeners) delete target.__litcodeListeners[name];
}

export function patchInput(current: HTMLInputElement, next: HTMLInputElement): void {
  if (current.value !== next.value) current.value = next.value;
  if (current.checked !== next.checked) current.checked = next.checked;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
  if (current.readOnly !== next.readOnly) current.readOnly = next.readOnly;
  if (current.required !== next.required) current.required = next.required;
}

export function patchOption(current: HTMLOptionElement, next: HTMLOptionElement): void {
  if (current.selected !== next.selected) current.selected = next.selected;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
}

export function patchSelect(current: HTMLSelectElement, next: HTMLSelectElement): void {
  const nextValue = next.getAttribute('value') ?? next.value;
  if (current.value !== nextValue) current.value = nextValue;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
  if (current.required !== next.required) current.required = next.required;
}

export function patchTextarea(current: HTMLTextAreaElement, next: HTMLTextAreaElement): void {
  if (current.value !== next.value) current.value = next.value;
  if (current.disabled !== next.disabled) current.disabled = next.disabled;
  if (current.readOnly !== next.readOnly) current.readOnly = next.readOnly;
  if (current.required !== next.required) current.required = next.required;
}

export function patchFormProperties(current: Element, next: Element): void {
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

export function patchElementTextChildren(current: Element, next: Element): boolean {
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

export function getNodeKey(node: Node): string | undefined {
  return node instanceof Element ? (node as LitcodeElement).__litcodeKey : undefined;
}

export function hasKeyedChildren(children: Node[]): boolean {
  for (let index = 0; index < children.length; index++) {
    if (getNodeKey(children[index]) !== undefined) return true;
  }

  return false;
}

export function hasAllKeys(children: Node[]): boolean {
  for (let index = 0; index < children.length; index++) {
    if (getNodeKey(children[index]) === undefined) return false;
  }

  return children.length > 0;
}

export function patchChildrenByIndex(parent: Node, nextChildren: Node[]): void {
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
    const child = parent.childNodes[index];
    if (child) parent.removeChild(child);
  }
}

export function patchKeyedChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = childNodesToArray(parent);
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
      while (
        unkeyedIndex < unkeyedCurrent.length &&
        usedCurrent.has(unkeyedCurrent[unkeyedIndex])
      ) {
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
    if (!usedCurrent.has(child) && child.parentNode === parent) parent.removeChild(child);
  }
}

export function patchFullyKeyedChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = childNodesToArray(parent);
  const keyedCurrent = new Map<string, Node>();
  const currentIndexes = new Map<Node, number>();
  const sources = new Array<number>(nextChildren.length);
  const patchedChildren = new Array<Node>(nextChildren.length);
  let matched = 0;

  for (let index = 0; index < currentChildren.length; index++) {
    const child = currentChildren[index];
    const key = getNodeKey(child);
    if (key !== undefined && !keyedCurrent.has(key)) keyedCurrent.set(key, child);
    currentIndexes.set(child, index);
  }

  for (let index = 0; index < nextChildren.length; index++) {
    const next = nextChildren[index];
    const key = getNodeKey(next);
    const current = key === undefined ? undefined : keyedCurrent.get(key);

    if (current) {
      sources[index] = currentIndexes.get(current) ?? -1;
      patchedChildren[index] = patchNode(current, next);
      matched++;
      continue;
    }

    sources[index] = -1;
    patchedChildren[index] = next;
  }

  if (matched !== currentChildren.length) {
    const retained = new Set<Node>(patchedChildren);

    for (let index = currentChildren.length - 1; index >= 0; index--) {
      const child = currentChildren[index];
      if (!retained.has(child) && child.parentNode === parent) parent.removeChild(child);
    }
  }

  const stable = longestIncreasingSubsequence(sources);
  let stableIndex = stable.length - 1;
  let anchor: Node | null = null;

  for (let index = patchedChildren.length - 1; index >= 0; index--) {
    const child = patchedChildren[index];

    if (sources[index] !== -1 && stableIndex >= 0 && stable[stableIndex] === index) {
      stableIndex--;
      anchor = child;
      continue;
    }

    if (child.nextSibling !== anchor) parent.insertBefore(child, anchor);
    anchor = child;
  }
}

export function longestIncreasingSubsequence(values: number[]): number[] {
  const predecessors = new Array<number>(values.length);
  const result: number[] = [];

  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value === -1) continue;

    let low = 0;
    let high = result.length;

    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[result[middle]] < value) low = middle + 1;
      else high = middle;
    }

    if (low > 0) predecessors[index] = result[low - 1];
    result[low] = index;
  }

  let cursor = result[result.length - 1];
  for (let index = result.length - 1; index >= 0; index--) {
    result[index] = cursor;
    cursor = predecessors[cursor];
  }

  return result;
}

export function patchChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = childNodesToArray(parent);

  if (currentChildren.length === 0) {
    appendNodes(parent, nextChildren);
    return;
  }

  if (nextChildren.length === 0) {
    parent.textContent = '';
    return;
  }

  if (currentChildren.length === nextChildren.length) {
    let sameKeys = true;

    for (let index = 0; index < currentChildren.length; index++) {
      const currentKey = getNodeKey(currentChildren[index]);
      const nextKey = getNodeKey(nextChildren[index]);

      if (currentKey !== nextKey) {
        sameKeys = false;
        break;
      }
    }

    if (sameKeys) {
      patchChildrenByIndex(parent, nextChildren);
      return;
    }
  }

  if (hasKeyedChildren(currentChildren) || hasKeyedChildren(nextChildren)) {
    if (
      currentChildren.length > 16 &&
      currentChildren.length === nextChildren.length &&
      hasAllKeys(currentChildren) &&
      hasAllKeys(nextChildren)
    ) {
      patchFullyKeyedChildren(parent, nextChildren);
      return;
    }

    patchKeyedChildren(parent, nextChildren);
    return;
  }

  patchChildrenByIndex(parent, nextChildren);
}

export function patchElement(current: Element, next: Element): void {
  (current as LitcodeElement).__litcodeKey = (next as LitcodeElement).__litcodeKey;
  patchAttributes(current, next);
  patchEvents(current, next);
  if (!patchElementTextChildren(current, next)) patchChildren(current, childNodesToArray(next));
  patchFormProperties(current, next);
}

export function patchNode(current: Node, next: Node): Node {
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

function appendNodes(target: Node, nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++) target.appendChild(nodes[index]);
}

function childNodesToArray(parent: Node): Node[] {
  const childNodes = parent.childNodes;
  const nodes = new Array<Node>(childNodes.length);

  for (let index = 0; index < childNodes.length; index++) nodes[index] = childNodes[index];

  return nodes;
}
