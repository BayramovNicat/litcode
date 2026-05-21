import { type ChildPart, type RepeatBlock } from './template';
import {
  normalize,
  patchNodesBeforeMarker,
  instantiateRepeatBlock,
  isTemplateResult,
} from './dom-internal';
import { updateTemplateInstance, destroyTemplateInstance } from './dom-template';

export function updateRepeatChildPart(part: ChildPart, value: any): void {
  const parent = part.marker.parentNode;
  if (!parent) return;

  const currentBlocks = part.repeat?.blocks ?? [];
  const keyedCurrent = new Map<string, RepeatBlock>();

  for (let index = 0; index < currentBlocks.length; index++) {
    const block = currentBlocks[index];
    if (!keyedCurrent.has(block.key)) keyedCurrent.set(block.key, block);
  }

  const length = value.items.length;
  const nextBlocks: RepeatBlock[] = new Array(length);
  const sources = new Array<number>(length);
  const retained = new Set<RepeatBlock>();

  for (let index = 0; index < length; index++) {
    const item = value.items[index];
    const key = String(value.key(item, index));
    const current = keyedCurrent.get(key);

    if (current) {
      retained.add(current);
      sources[index] = current.index;

      if (Object.is(current.item, item) && current.index === index) {
        current.item = item;
        current.index = index;
      } else if (current.instance) {
        const rendered = value.render(item, index);

        if (isTemplateResult(rendered) && current.instance.result.strings === rendered.strings) {
          updateTemplateInstance(current.instance, rendered);
          current.nodes = current.instance.nodes;
          current.item = item;
          current.index = index;
        } else {
          destroyTemplateInstance(current.instance);
          current.instance = undefined;
          const nextNodes = normalize(rendered);
          current.nodes = patchNodesBeforeMarker(parent, current.nodes, nextNodes, part.marker);
          current.instance = isTemplateResult(rendered)
            ? (nextNodes as any).__litcodeInstance
            : undefined;
          current.item = item;
          current.index = index;
        }
      } else {
        const rendered = value.render(item, index);
        const nextNodes = normalize(rendered);
        current.nodes = patchNodesBeforeMarker(parent, current.nodes, nextNodes, part.marker);
        current.instance = isTemplateResult(rendered)
          ? ((nextNodes as any).__litcodeInstance ?? current.instance)
          : undefined;
        current.item = item;
        current.index = index;
      }

      nextBlocks[index] = current;
      continue;
    }

    const rendered = value.render(item, index);
    sources[index] = -1;
    nextBlocks[index] = instantiateRepeatBlock(rendered, key, item, index);
  }

  for (let index = 0; index < currentBlocks.length; index++) {
    const block = currentBlocks[index];
    if (retained.has(block)) continue;

    block.cleanup?.();
    if (block.instance) destroyTemplateInstance(block.instance);
    removeNodes(block.nodes);
  }

  moveRepeatBlocks(parent, nextBlocks, sources, part.marker);

  part.nodes = collectRepeatNodes(nextBlocks);
  part.instance = undefined;
  part.repeat = { blocks: nextBlocks };
}

export function moveRepeatBlocks(
  parent: Node,
  blocks: RepeatBlock[],
  sources: number[],
  marker: Comment,
): void {
  const stable = longestIncreasingSubsequence(sources);

  if (stable.length < blocks.length / 2) {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < blocks.length; index++) {
      appendNodes(fragment, blocks[index].nodes);
    }

    parent.insertBefore(fragment, marker);
    return;
  }

  let stableIndex = stable.length - 1;
  let anchor: Node | null = marker;

  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index];
    const first = block.nodes[0];

    if (sources[index] !== -1 && stableIndex >= 0 && stable[stableIndex] === index) {
      stableIndex--;
      anchor = first;
      continue;
    }

    for (let nodeIndex = block.nodes.length - 1; nodeIndex >= 0; nodeIndex--) {
      const node = block.nodes[nodeIndex];
      if (node.nextSibling !== anchor) parent.insertBefore(node, anchor);
      anchor = node;
    }
  }
}

export function collectRepeatNodes(blocks: RepeatBlock[]): Node[] {
  let length = 0;
  for (let index = 0; index < blocks.length; index++) length += blocks[index].nodes.length;

  const nodes = new Array<Node>(length);
  let offset = 0;

  for (let index = 0; index < blocks.length; index++) {
    const blockNodes = blocks[index].nodes;

    for (let nodeIndex = 0; nodeIndex < blockNodes.length; nodeIndex++) {
      nodes[offset++] = blockNodes[nodeIndex];
    }
  }

  return nodes;
}

export function removeNodes(nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++)
    nodes[index].parentNode?.removeChild(nodes[index]);
}

function appendNodes(target: Node, nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++) target.appendChild(nodes[index]);
}

function longestIncreasingSubsequence(values: number[]): number[] {
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
