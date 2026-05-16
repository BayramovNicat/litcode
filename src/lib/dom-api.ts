import type { MountHandle, View, TemplateResult } from './types';
import { isTemplateResult, normalize } from './dom-internal';
import {
  updateTemplateInstance,
  instantiateTemplate,
  destroyTemplateInstance,
} from './dom-template';
import { patchChildren } from './patch';

export function render(view: View, target: ParentNode): MountHandle {
  const parent = target as unknown as HTMLElement;
  let rootInstance = isTemplateResult(view) ? instantiateTemplate(view) : undefined;
  parent.replaceChildren(rootInstance ? rootInstance.fragment : makeFragment(view));

  return {
    update(next) {
      if (
        rootInstance &&
        isTemplateResult(next) &&
        rootInstance.result.strings === (next as TemplateResult).strings
      ) {
        updateTemplateInstance(rootInstance, next as TemplateResult);
        return;
      }

      if (rootInstance) {
        destroyTemplateInstance(rootInstance);
      }

      if (isTemplateResult(next)) {
        const nextInstance = instantiateTemplate(next as TemplateResult);
        patchChildren(parent, nextInstance.nodes);
        rootInstance = nextInstance;
        return;
      }

      patchChildren(parent, Array.from(makeFragment(next).childNodes));
      rootInstance = undefined;
    },
    destroy() {
      if (rootInstance) destroyTemplateInstance(rootInstance);
      parent.replaceChildren();
      rootInstance = undefined;
    },
  };
}

export function mount(view: View, target: ParentNode): MountHandle {
  return render(view, target);
}

export function toFragment(view: View): DocumentFragment {
  return makeFragment(view);
}

export function makeFragment(view: View): DocumentFragment {
  const fragment = document.createDocumentFragment();
  append(fragment, view);
  return fragment;
}

export function append(parent: Node, view: View) {
  appendNodes(parent, normalize(view));
}

function appendNodes(target: Node, nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++) target.appendChild(nodes[index]);
}
