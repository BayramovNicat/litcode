import type { MountHandle, View } from './types';

const markerPrefix = 'litcode-part-';

type EventBinding = {
  name: string;
  handler: EventListener;
};

type TemplateValue = View | EventListener;

type LitcodeElement = Element & {
  __litcodeEvents?: Record<string, EventListener | undefined>;
  __litcodeListeners?: Record<string, EventListener | undefined>;
  __litcodeKey?: string;
};

const booleanAttributes = new Set(['disabled', 'checked', 'selected', 'readonly', 'required']);

function isNode(value: unknown): value is Node {
  return typeof Node !== 'undefined' && value instanceof Node;
}

function normalize(view: View): Node[] {
  if (Array.isArray(view)) return view.flatMap((child) => normalize(child));
  if (view === null || view === undefined || view === false) return [];
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

function eventNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s(on[a-z][\w-]*)\s*=\s*$/i);
  return match?.[1]?.slice(2).toLowerCase();
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

function replaceComment(comment: Comment, view: View) {
  const nodes = normalize(view);
  comment.replaceWith(...nodes);
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
    const target = element as LitcodeElement;
    target.__litcodeKey = element.getAttribute('key') ?? undefined;
    element.removeAttribute('key');
  });
}

export function html(strings: TemplateStringsArray, ...values: TemplateValue[]): DocumentFragment {
  const eventBindings = new Map<string, EventBinding>();
  let source = '';

  strings.forEach((part, index) => {
    source += part;
    if (index >= values.length) return;

    const value = values[index];
    const eventName = typeof value === 'function' ? eventNameFromAttribute(part) : undefined;

    if (eventName) {
      const id = `${markerPrefix}${index}`;
      source += `"${id}"`;
      eventBindings.set(id, {
        name: eventName,
        handler: value as EventListener,
      });
      return;
    }

    if (isInsideTag(source)) {
      source += escapeAttribute(value);
      return;
    }

    source += `<!--${markerPrefix}${index}-->`;
  });

  const template = document.createElement('template');
  template.innerHTML = source.trim();
  const fragment = template.content.cloneNode(true) as DocumentFragment;

  eventBindings.forEach((binding, id) => {
    const elements = fragment.querySelectorAll(`[on${binding.name}="${id}"]`);
    elements.forEach((element) => {
      element.removeAttribute(`on${binding.name}`);
      setEvent(element, binding.name, binding.handler);
    });
  });

  applyKeys(fragment);

  booleanAttributes.forEach((attribute) => {
    fragment.querySelectorAll(`[${attribute}=""]`).forEach((element) => {
      if (attribute in element) {
        (element as unknown as Record<string, boolean>)[attribute] = true;
      }

      element.removeAttribute(attribute);
    });
  });

  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);

  comments.forEach((comment) => {
    const data = comment.data.trim();
    if (!data.startsWith(markerPrefix)) return;
    const index = Number(data.slice(markerPrefix.length));
    replaceComment(comment, values[index] as View);
  });

  return fragment;
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
  Array.from(current.attributes).forEach((attribute) => {
    if (!next.hasAttribute(attribute.name)) {
      current.removeAttribute(attribute.name);
    }
  });

  Array.from(next.attributes).forEach((attribute) => {
    if (current.getAttribute(attribute.name) !== attribute.value) {
      current.setAttribute(attribute.name, attribute.value);
    }
  });
}

function patchEvents(current: Element, next: Element): void {
  const currentElement = current as LitcodeElement;
  const nextElement = next as LitcodeElement;
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
  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    patchInput(current, next);
    return;
  }

  if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
    patchTextarea(current, next);
    return;
  }

  if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    patchSelect(current, next);
    return;
  }

  if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
    patchOption(current, next);
  }
}

function getNodeKey(node: Node): string | undefined {
  return node instanceof Element ? (node as LitcodeElement).__litcodeKey : undefined;
}

function hasKeyedChildren(children: Node[]): boolean {
  return children.some((child) => getNodeKey(child) !== undefined);
}

function patchChildrenByIndex(parent: Node, nextChildren: Node[]): void {
  const currentChildren = Array.from(parent.childNodes);
  const length = Math.max(currentChildren.length, nextChildren.length);

  for (let index = 0; index < length; index++) {
    const current = currentChildren[index];
    const next = nextChildren[index];

    if (!current && next) {
      parent.appendChild(next);
      continue;
    }

    if (current && !next) {
      current.remove();
      continue;
    }

    if (current && next) {
      patchNode(current, next);
    }
  }
}

function patchKeyedChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = Array.from(parent.childNodes);
  const keyedCurrent = new Map<string, Node>();
  const unkeyedCurrent = currentChildren.filter((child) => {
    const key = getNodeKey(child);
    if (key === undefined) return true;
    if (!keyedCurrent.has(key)) keyedCurrent.set(key, child);
    return false;
  });
  const usedCurrent = new Set<Node>();
  let unkeyedIndex = 0;

  nextChildren.forEach((next, index) => {
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
      return;
    }

    usedCurrent.add(current);
    const patched = patchNode(current, next);
    if (patched !== reference) parent.insertBefore(patched, reference);
  });

  currentChildren.forEach((child) => {
    if (!usedCurrent.has(child) && child.parentNode === parent) child.remove();
  });
}

function patchChildren(parent: Node, nextChildren: Node[]): void {
  const currentChildren = Array.from(parent.childNodes);

  if (hasKeyedChildren(currentChildren) || hasKeyedChildren(nextChildren)) {
    patchKeyedChildren(parent, nextChildren);
    return;
  }

  patchChildrenByIndex(parent, nextChildren);
}

function patchElement(current: Element, next: Element): void {
  (current as LitcodeElement).__litcodeKey = (next as LitcodeElement).__litcodeKey;
  patchAttributes(current, next);
  patchEvents(current, next);
  patchChildren(current, Array.from(next.childNodes));
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
  parent.replaceChildren(makeFragment(view));

  return {
    update(next) {
      patchChildren(parent, Array.from(makeFragment(next).childNodes));
    },
    destroy() {
      parent.replaceChildren();
    },
  };
}

export function mount(view: View, target: ParentNode): MountHandle {
  return render(view, target);
}
