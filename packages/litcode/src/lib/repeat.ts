import { type ChildPart, type RepeatBlock } from './template';
import {
  normalize,
  patchNodesBeforeMarker,
  instantiateRepeatBlock,
  isTemplateResult,
} from './dom-internal';
import {
  updateTemplateInstance,
  destroyTemplateInstance,
  cleanupElementEffects,
} from './dom-template';

export function updateRepeatChildPart(part: ChildPart, value: any): void {
  const parent = part.marker.parentNode;
  if (!parent) return;

  const currentBlocks = (part.repeat?.blocks ?? []) as (RepeatBlock | null)[];
  const oldLength = currentBlocks.length;
  const newLength = value.items.length;

  const nextBlocks: RepeatBlock[] = new Array(newLength);
  const skipIndexCheck = value.render.length < 2;

  // Pre-calculate new keys to avoid repeated key calls
  const newKeys = new Array<string>(newLength);
  for (let i = 0; i < newLength; i++) {
    newKeys[i] = String(value.key(value.items[i], i));
  }

  let oldHead = 0;
  let oldTail = oldLength - 1;
  let newHead = 0;
  let newTail = newLength - 1;

  let newKeyToIndexMap: Map<string, number> | undefined;
  let oldKeyToIndexMap: Map<string, number> | undefined;

  // Helper to patch a block in place
  const patchBlock = (block: RepeatBlock, item: any, index: number): void => {
    if (Object.is(block.item, item) && (skipIndexCheck || block.index === index)) {
      block.item = item;
      block.index = index;
      return;
    }
    const localMarker =
      index + 1 < newLength
        ? nextBlocks[index + 1]
          ? nextBlocks[index + 1].nodes[0]
          : part.marker
        : part.marker;
    if (block.instance) {
      const rendered = value.render(item, index);
      if (isTemplateResult(rendered) && block.instance.result.strings === rendered.strings) {
        updateTemplateInstance(block.instance, rendered);
        block.nodes = block.instance.nodes;
        block.item = item;
        block.index = index;
      } else {
        destroyTemplateInstance(block.instance);
        block.instance = undefined;
        const nextNodes = normalize(rendered);
        block.nodes = patchNodesBeforeMarker(parent, block.nodes, nextNodes, localMarker);
        block.instance = isTemplateResult(rendered)
          ? (nextNodes as any).__litcodeInstance
          : undefined;
        block.item = item;
        block.index = index;
      }
    } else {
      const rendered = value.render(item, index);
      const nextNodes = normalize(rendered);
      block.nodes = patchNodesBeforeMarker(parent, block.nodes, nextNodes, localMarker);
      block.instance = isTemplateResult(rendered)
        ? ((nextNodes as any).__litcodeInstance ?? block.instance)
        : undefined;
      block.item = item;
      block.index = index;
    }
  };

  // Helper to move block's DOM nodes before a given anchor Node
  const moveBlockBefore = (block: RepeatBlock, anchor: Node | null): void => {
    const nodes = block.nodes;
    for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex--) {
      const node = nodes[nodeIndex];
      if (node.nextSibling !== anchor) {
        parent.insertBefore(node, anchor);
      }
      anchor = node;
    }
  };

  // Helper to clean up and remove a block
  const cleanupBlock = (block: RepeatBlock): void => {
    block.cleanup?.();
    if (block.instance) {
      destroyTemplateInstance(block.instance);
    }
    const nodes = block.nodes;
    for (let index = 0; index < nodes.length; index++) {
      cleanupElementEffects(nodes[index]);
      nodes[index].parentNode?.removeChild(nodes[index]);
    }
  };

  if (oldLength === newLength && newLength > 16 && skipIndexCheck) {
    let isExactReverse = true;

    for (let index = 0; index < newLength; index++) {
      const block = currentBlocks[oldLength - 1 - index];
      if (
        block === null ||
        block.key !== newKeys[index] ||
        !Object.is(block.item, value.items[index])
      ) {
        isExactReverse = false;
        break;
      }
    }

    if (isExactReverse) {
      const fragment = document.createDocumentFragment();

      for (let index = 0; index < newLength; index++) {
        const block = currentBlocks[oldLength - 1 - index]!;
        block.index = index;
        nextBlocks[index] = block;
        appendBlockNodes(fragment, block);
      }

      parent.insertBefore(fragment, part.marker);
      commitRepeatPart(part, nextBlocks);
      return;
    }
  }

  while (oldHead <= oldTail && newHead <= newTail) {
    const oldBlockHead = currentBlocks[oldHead];
    const oldBlockTail = currentBlocks[oldTail];

    if (oldBlockHead === null) {
      oldHead++;
    } else if (oldBlockTail === null) {
      oldTail--;
    } else if (oldBlockHead.key === newKeys[newHead]) {
      // Old head matches new head; update in place
      patchBlock(oldBlockHead, value.items[newHead], newHead);
      nextBlocks[newHead] = oldBlockHead;
      oldHead++;
      newHead++;
    } else if (oldBlockTail.key === newKeys[newTail]) {
      // Old tail matches new tail; update in place
      patchBlock(oldBlockTail, value.items[newTail], newTail);
      nextBlocks[newTail] = oldBlockTail;
      oldTail--;
      newTail--;
    } else if (oldBlockHead.key === newKeys[newTail]) {
      // Old head matches new tail; update and move to new tail
      patchBlock(oldBlockHead, value.items[newTail], newTail);
      const anchor = newTail + 1 < newLength ? nextBlocks[newTail + 1].nodes[0] : part.marker;
      moveBlockBefore(oldBlockHead, anchor);
      nextBlocks[newTail] = oldBlockHead;
      oldHead++;
      newTail--;
    } else if (oldBlockTail.key === newKeys[newHead]) {
      // Old tail matches new head; update and move to new head
      patchBlock(oldBlockTail, value.items[newHead], newHead);
      const anchor = oldBlockHead.nodes[0];
      moveBlockBefore(oldBlockTail, anchor);
      nextBlocks[newHead] = oldBlockTail;
      oldTail--;
      newHead++;
    } else {
      if (newKeyToIndexMap === undefined) {
        newKeyToIndexMap = new Map<string, number>();
        for (let i = newHead; i <= newTail; i++) {
          newKeyToIndexMap.set(newKeys[i], i);
        }
        oldKeyToIndexMap = new Map<string, number>();
        for (let i = oldHead; i <= oldTail; i++) {
          const b = currentBlocks[i];
          if (b !== null) {
            oldKeyToIndexMap.set(b.key, i);
          }
        }
      }

      const oldKeyAtHead = oldBlockHead.key;
      const oldKeyAtTail = oldBlockTail.key;

      if (!newKeyToIndexMap.has(oldKeyAtHead)) {
        // Old head is no longer in new list; remove
        cleanupBlock(oldBlockHead);
        oldHead++;
      } else if (!newKeyToIndexMap.has(oldKeyAtTail)) {
        // Old tail is no longer in new list; remove
        cleanupBlock(oldBlockTail);
        oldTail--;
      } else {
        // Find existing block
        const oldIndex = oldKeyToIndexMap!.get(newKeys[newHead]);
        const oldBlock = oldIndex !== undefined ? currentBlocks[oldIndex] : null;

        if (oldBlock === null) {
          // Create new block and insert before current old head
          const item = value.items[newHead];
          const rendered = value.render(item, newHead);
          const block = instantiateRepeatBlock(rendered, newKeys[newHead], item, newHead);
          const anchor = oldBlockHead.nodes[0];
          moveBlockBefore(block, anchor);
          nextBlocks[newHead] = block;
        } else {
          // Reuse old block
          patchBlock(oldBlock, value.items[newHead], newHead);
          const anchor = oldBlockHead.nodes[0];
          moveBlockBefore(oldBlock, anchor);
          nextBlocks[newHead] = oldBlock;
          currentBlocks[oldIndex!] = null; // Mark as used
        }
        newHead++;
      }
    }
  }

  // Add parts for any remaining new values
  while (newHead <= newTail) {
    const item = value.items[newHead];
    const rendered = value.render(item, newHead);
    const block = instantiateRepeatBlock(rendered, newKeys[newHead], item, newHead);
    const anchor = newTail + 1 < newLength ? nextBlocks[newTail + 1].nodes[0] : part.marker;
    moveBlockBefore(block, anchor);
    nextBlocks[newHead] = block;
    newHead++;
  }

  // Remove any remaining unused old parts
  while (oldHead <= oldTail) {
    const block = currentBlocks[oldHead++];
    if (block !== null) {
      cleanupBlock(block);
    }
  }

  commitRepeatPart(part, nextBlocks);
}

function appendBlockNodes(parent: Node, block: RepeatBlock): void {
  const nodes = block.nodes;

  for (let index = 0; index < nodes.length; index++) parent.appendChild(nodes[index]);
}

function commitRepeatPart(part: ChildPart, blocks: RepeatBlock[]): void {
  part.nodes.length = 0;
  part.instance = undefined;
  part.array = undefined;
  part.repeat = { blocks };
}
