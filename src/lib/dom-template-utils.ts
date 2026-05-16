import { type LitcodeElement, keySelector } from './template';
import { booleanAttributes, booleanSelector } from './template';

export function pathToNode(root: Node, path: number[]): Node | undefined {
  let node: Node | undefined = root;

  for (let index = 0; index < path.length; index++) {
    node = node.childNodes[path[index]];
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

    path.push(Array.prototype.indexOf.call(parentNode.childNodes, current));
    current = parentNode;
  }

  return path.reverse();
}

export function applyKeys(root: ParentNode): void {
  root.querySelectorAll(keySelector).forEach((element) => {
    const key = element.getAttribute('key') ?? undefined;

    const target = element as LitcodeElement;
    target.__litcodeKey = key;
    element.removeAttribute('key');
  });
}

export function createFragmentFromCache(cached: any): DocumentFragment {
  const fragment = cached.template.content.cloneNode(true) as DocumentFragment;

  if (cached.hasBooleanAttributes) {
    fragment.querySelectorAll(booleanSelector).forEach((element: any) => {
      booleanAttributes.forEach((attribute) => {
        if (element.getAttribute(attribute) !== '') return;

        if (attribute in element) {
          element[attribute] = true;
        }

        element.removeAttribute(attribute);
      });
    });
  }

  if (cached.hasKeys) applyKeys(fragment);

  return fragment;
}
