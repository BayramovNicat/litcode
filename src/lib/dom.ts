import type { MountHandle, View } from './types';

const markerPrefix = 'litcode-part-';

type EventBinding = {
  name: string;
  handler: EventListener;
};

type TemplateValue = View | EventListener;

type LitcodeElement = Element & {
  __litcodeEvents?: Record<string, EventListener>;
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
      const target = element as LitcodeElement;
      element.removeAttribute(`on${binding.name}`);
      target.__litcodeEvents ??= {};
      target.__litcodeEvents[binding.name] = binding.handler;
      element.addEventListener(binding.name, binding.handler);
    });
  });

  booleanAttributes.forEach((attribute) => {
    fragment.querySelectorAll(`[${attribute}=""]`).forEach((element) => {
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

  Object.entries(currentEvents).forEach(([name, handler]) => {
    if (nextEvents[name] !== handler) {
      current.removeEventListener(name, handler);
    }
  });

  Object.entries(nextEvents).forEach(([name, handler]) => {
    if (currentEvents[name] !== handler) {
      current.addEventListener(name, handler);
    }
  });

  currentElement.__litcodeEvents = nextEvents;
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
  if (current.value !== next.value) current.value = next.value;
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

function patchChildren(parent: Node, nextChildren: Node[]): void {
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

function patchElement(current: Element, next: Element): void {
  patchAttributes(current, next);
  patchEvents(current, next);
  patchFormProperties(current, next);
  patchChildren(current, Array.from(next.childNodes));
}

function patchNode(current: Node, next: Node): void {
  if (!sameNodeType(current, next)) {
    current.parentNode?.replaceChild(next, current);
    return;
  }

  if (current.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
    patchText(current, next);
    return;
  }

  if (current instanceof Element && next instanceof Element) {
    patchElement(current, next);
  }
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
