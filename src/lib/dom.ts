import type { MountHandle, View } from './types';

const markerPrefix = 'litcode-part-';

type EventBinding = {
  name: string;
  handler: EventListener;
};

type TemplateValue = View | EventListener;

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
      element.removeAttribute(`on${binding.name}`);
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

export function render(view: View, target: ParentNode): MountHandle {
  const parent = target as unknown as HTMLElement;
  parent.replaceChildren(makeFragment(view));

  return {
    update(next) {
      parent.replaceChildren(makeFragment(next));
    },
    destroy() {
      parent.replaceChildren();
    },
  };
}

export function mount(view: View, target: ParentNode): MountHandle {
  return render(view, target);
}
