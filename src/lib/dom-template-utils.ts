import { type LitcodeElement, keySelector } from './template';
import { booleanAttributes, booleanSelector } from './template';

export function pathToNode(root: Node, path: number[]): Node | undefined {
  let node: Node | undefined = root;

  for (let index = 0; index < path.length; index++) {
    let child = node.firstChild;
    const targetIdx = path[index];
    for (let i = 0; i < targetIdx && child; i++) {
      child = child.nextSibling;
    }
    node = child ?? undefined;
    if (!node) return undefined;
  }

  return node;
}

export function getNodePath(node: Node, root: Node): number[] {
  const path: number[] = [];
  let current: Node | null = node;

  while (current && current !== root) {
    const parentNode: ParentNode | null = current.parentNode;
    if (!parentNode) break;

    let index = 0;
    let sibling = current.previousSibling;
    while (sibling) {
      index++;
      sibling = sibling.previousSibling;
    }
    path.push(index);
    current = parentNode;
  }

  return path.reverse();
}

export function applyKeys(root: ParentNode): void {
  const elements = root.querySelectorAll(keySelector);

  for (let index = 0; index < elements.length; index++) {
    const element = elements[index];
    const key = element.getAttribute('key') ?? undefined;

    const target = element as LitcodeElement;
    target.__litcodeKey = key;
    element.removeAttribute('key');
  }
}

export function createFragmentFromCache(cached: any): DocumentFragment {
  const fragment = cached.template.content.cloneNode(true) as DocumentFragment;

  if (cached.hasBooleanAttributes) {
    const elements = fragment.querySelectorAll(booleanSelector);

    for (let index = 0; index < elements.length; index++) {
      const element = elements[index] as any;

      for (const attribute of booleanAttributes) {
        if (element.getAttribute(attribute) !== '') continue;

        if (attribute in element) {
          element[attribute] = true;
        }

        element.removeAttribute(attribute);
      }
    }
  }

  if (cached.hasKeys) applyKeys(fragment);

  return fragment;
}
