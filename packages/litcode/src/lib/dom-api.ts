import type { MountHandle, View, TemplateResult } from './types';
import { hasSameTemplateShape, isTemplateResult, normalize } from './dom-internal';
import {
  updateTemplateInstance,
  instantiateTemplate,
  destroyTemplateInstance,
} from './dom-template';
import { patchChildren } from './patch';

/**
 * Renders a `View` into a target node and returns an update handle.
 *
 * Subsequent calls to `update()` reuse existing DOM where possible.
 */
export function render(view: View, target: ParentNode): MountHandle {
  const parent = target as unknown as HTMLElement;
  let rootInstance = isTemplateResult(view) ? instantiateTemplate(view) : undefined;
  replaceChildren(parent, rootInstance ? rootInstance.fragment : makeFragment(view));

  return {
    update(next) {
      if (
        rootInstance &&
        isTemplateResult(next) &&
        hasSameTemplateShape(rootInstance.result, next as TemplateResult)
      ) {
        updateTemplateInstance(rootInstance, next as TemplateResult);
        return;
      }

      if (rootInstance) {
        destroyTemplateInstance(rootInstance);
      }

      if (isTemplateResult(next)) {
        const nextInstance = instantiateTemplate(next as TemplateResult);
        if (nextInstance.parts.length === 0) {
          patchChildren(parent, nextInstance.nodes);
          rootInstance = undefined;
        } else {
          replaceChildren(parent, nextInstance.fragment);
          rootInstance = nextInstance;
        }
        return;
      }

      patchChildren(parent, childNodesToArray(makeFragment(next)));
      rootInstance = undefined;
    },
    destroy() {
      if (rootInstance) destroyTemplateInstance(rootInstance);
      clearChildren(parent);
      rootInstance = undefined;
    },
  };
}

/**
 * Alias for {@link render}.
 *
 * `mount` and `render` share the same behavior and return the same handle.
 */
export function mount(view: View, target: ParentNode): MountHandle {
  return render(view, target);
}

/**
 * Converts a `View` into a detached `DocumentFragment`.
 *
 * This is useful when you need DOM nodes without mounting them yet.
 */
export function toFragment(view: View): DocumentFragment {
  return makeFragment(view);
}

/**
 * Converts a `View` into a detached `DocumentFragment`.
 */
export function makeFragment(view: View): DocumentFragment {
  const fragment = document.createDocumentFragment();
  append(fragment, view);
  return fragment;
}

/**
 * Appends a `View` into an existing node.
 */
export function append(parent: Node, view: View) {
  appendNodes(parent, normalize(view));
}

function appendNodes(target: Node, nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++) target.appendChild(nodes[index]);
}

function replaceChildren(parent: Node, node: Node): void {
  clearChildren(parent);
  parent.appendChild(node);
}

function clearChildren(parent: Node): void {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
}

function childNodesToArray(parent: Node): Node[] {
  const childNodes = parent.childNodes;
  const nodes = new Array<Node>(childNodes.length);

  for (let index = 0; index < childNodes.length; index++) nodes[index] = childNodes[index];

  return nodes;
}
