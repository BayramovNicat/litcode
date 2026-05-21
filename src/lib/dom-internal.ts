import type { View, RepeatResult, TemplateResult } from './types';
import { type ChildPart, type RepeatBlock, type InstantiatedNodes } from './template';
import { instantiateTemplate } from './dom-template';
import { patchNode } from './patch';

export function isNode(value: unknown): value is Node {
  return typeof Node !== 'undefined' && value instanceof Node;
}

export function isTemplateResult(value: unknown): value is TemplateResult {
  return (
    !!value && typeof value === 'object' && (value as TemplateResult).__litcodeTemplate === true
  );
}

export function isRepeatResult(value: unknown): value is RepeatResult {
  return !!value && typeof value === 'object' && (value as RepeatResult).__litcodeRepeat === true;
}

export function isFragment(value: unknown): value is DocumentFragment {
  return isNode(value) && value.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}

export function normalize(view: View): Node[] {
  if (Array.isArray(view)) {
    const nodes: Node[] = [];

    for (let index = 0; index < view.length; index++) {
      const childNodes = normalize(view[index]);
      for (let nodeIndex = 0; nodeIndex < childNodes.length; nodeIndex++)
        nodes.push(childNodes[nodeIndex]);
    }

    return nodes;
  }

  if (view === null || view === undefined || view === false) return [];
  if (isTemplateResult(view)) {
    const instance = instantiateTemplate(view);
    const nodes = instance.nodes as InstantiatedNodes;
    nodes.__litcodeInstance = instance;
    return nodes;
  }
  if (isRepeatResult(view)) return normalizeRepeat(view);
  if (isFragment(view)) {
    return childNodesToArray(view);
  }
  if (isNode(view)) return [view];
  return [document.createTextNode(String(view))];
}

export function normalizeRepeat(result: RepeatResult): Node[] {
  const nodes: Node[] = [];

  for (let index = 0; index < result.items.length; index++) {
    const item = result.items[index];
    const block = instantiateRepeatBlock(
      result.render(item, index),
      String(result.key(item, index)),
      item,
      index,
    );
    pushNodes(nodes, block.nodes);
  }

  return nodes;
}

export function instantiateRepeatBlock(
  view: View,
  key: string,
  item?: unknown,
  index = 0,
): RepeatBlock {
  const nodes = normalize(view);
  const instance = (nodes as InstantiatedNodes).__litcodeInstance;
  return { key, item, index, nodes, instance };
}

export function pushNodes(target: Node[], nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++) target.push(nodes[index]);
}

export function patchNodesBeforeMarker(
  parent: Node,
  currentNodes: Node[],
  nextNodes: Node[],
  marker: Node,
): Node[] {
  const nextLen = nextNodes.length;
  const currentLen = currentNodes.length;
  const patchedNodes = new Array<Node>(nextLen);
  const commonLen = currentLen < nextLen ? currentLen : nextLen;

  // 1. Patch common elements
  for (let index = 0; index < commonLen; index++) {
    patchedNodes[index] = patchNode(currentNodes[index], nextNodes[index]);
  }

  // 2. Append new elements
  for (let index = commonLen; index < nextLen; index++) {
    const next = nextNodes[index];
    parent.insertBefore(next, marker);
    patchedNodes[index] = next;
  }

  // 3. Remove excess current elements
  for (let index = commonLen; index < currentLen; index++) {
    const current = currentNodes[index];
    current.parentNode?.removeChild(current);
  }

  return patchedNodes;
}

export function findChildPartBefore(nodes: Node[], fallbackParent: Node): ChildPart | undefined {
  const first = nodes[0];
  const previous = first ? first.previousSibling : fallbackParent.lastChild;
  return previous?.nodeType === Node.COMMENT_NODE && (previous as any).__litcodePart
    ? (previous as any).__litcodePart
    : undefined;
}

export function resetChildPart(part: ChildPart, nodes: Node[], instance?: any): void {
  part.nodes = nodes;
  part.instance = instance;
  part.array = undefined;
  part.repeat = undefined;
}

function childNodesToArray(parent: Node): Node[] {
  const childNodes = parent.childNodes;
  const nodes = new Array<Node>(childNodes.length);

  for (let index = 0; index < childNodes.length; index++) nodes[index] = childNodes[index];

  return nodes;
}
