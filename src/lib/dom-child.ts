import { type ChildPart } from './template';
import { isTemplateResult, normalize, findChildPartBefore, patchNodesBeforeMarker, resetChildPart } from './dom-internal';
import { updateTemplateInstance, destroyTemplateInstance } from './dom-template';
import { updateRepeatChildPart } from './repeat';

function destroyRepeatBlocks(repeat: ChildPart['repeat']): void {
  if (!repeat) return;

  for (let b = 0; b < repeat.blocks.length; b++) {
    const block = repeat.blocks[b];
    block.cleanup?.();
    if (block.instance) destroyTemplateInstance(block.instance);
  }
}

function destroyRepeatPart(part: ChildPart): void {
  destroyRepeatBlocks(part.repeat);

  part.repeat = undefined;
}

export function updateChildPart(part: ChildPart, value: unknown): void {
  if (isRepeatResult(value)) {
    if (part.instance) {
      destroyTemplateInstance(part.instance);
      part.instance = undefined;
    }
    updateRepeatChildPart(part, value as any);
    return;
  }

  const previousInstance = part.instance;
  const previousRepeat = part.repeat;

  if (isPrimitiveChild(value) && updatePrimitiveChildPart(part, value)) {
    if (previousInstance) destroyTemplateInstance(previousInstance);
    destroyRepeatBlocks(previousRepeat);
    return;
  }

  if (part.instance && isTemplateResult(value) && part.instance.result.strings === value.strings) {
    updateTemplateInstance(part.instance, value);
    part.nodes = part.instance.nodes;
    destroyRepeatPart(part);
    return;
  }

  const nodes = normalize(value as any);
  const parent = part.marker.parentNode;
  if (!parent) return;

  const instance = isTemplateResult(value)
    ? ((nodes as any).__litcodeInstance ?? findChildPartBefore(nodes, parent)?.instance)
    : undefined;

  if (previousInstance && previousInstance !== instance) destroyTemplateInstance(previousInstance);
  destroyRepeatBlocks(previousRepeat);

  resetChildPart(part, patchNodesBeforeMarker(parent, part.nodes, nodes, part.marker), instance);
}

export function updatePrimitiveChildPart(part: ChildPart, value: string | number | boolean | null | undefined): boolean {
  const parent = part.marker.parentNode;
  if (!parent) return true;

  if (value === null || value === undefined || value === false) {
    removeNodes(part.nodes);
    resetChildPart(part, []);
    return true;
  }

  const text = String(value);
  const current = part.nodes[0];

  if (current?.nodeType === Node.TEXT_NODE) {
    if (current.textContent !== text) current.textContent = text;

    if (part.nodes.length > 1) removeNodes(part.nodes.slice(1));

    resetChildPart(part, [current]);
    return true;
  }

  const next = document.createTextNode(text);
  parent.insertBefore(next, current ?? part.marker);

  removeNodes(part.nodes);

  resetChildPart(part, [next]);
  return true;
}

export function isPrimitiveChild(value: unknown): value is string | number | boolean | null | undefined {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function removeNodes(nodes: Node[]): void {
  for (let index = 0; index < nodes.length; index++) nodes[index].parentNode?.removeChild(nodes[index]);
}

function isRepeatResult(value: any) { return value?.__litcodeRepeat === true; }
