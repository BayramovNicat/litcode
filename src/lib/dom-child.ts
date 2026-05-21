import { type ChildPart, type TemplateInstance } from './template';
import {
  isTemplateResult,
  normalize,
  findChildPartBefore,
  patchNodesBeforeMarker,
  resetChildPart,
} from './dom-internal';
import {
  updateTemplateInstance,
  destroyTemplateInstance,
  instantiateTemplate,
} from './dom-template';
import { updateRepeatChildPart } from './repeat';

function destroyRepeatBlocks(repeat: ChildPart['repeat'], removeDom = false): void {
  if (!repeat) return;

  for (let b = 0; b < repeat.blocks.length; b++) {
    const block = repeat.blocks[b];
    block.cleanup?.();
    if (block.instance) destroyTemplateInstance(block.instance);
    if (removeDom) removeNodes(block.nodes);
  }
}

function destroyRepeatPart(part: ChildPart): void {
  destroyRepeatBlocks(part.repeat);

  part.repeat = undefined;
}

function destroyTemplateArrayInstances(instances: TemplateInstance[] | undefined): void {
  if (!instances) return;

  for (let index = 0; index < instances.length; index++) destroyTemplateInstance(instances[index]);
}

export function updateChildPart(part: ChildPart, value: unknown): void {
  if (isRepeatResult(value)) {
    if (!part.repeat && part.nodes.length > 0) {
      removeNodes(part.nodes);
      part.nodes.length = 0;
    }
    if (part.instance) {
      destroyTemplateInstance(part.instance);
      part.instance = undefined;
    }
    if (part.array) {
      destroyTemplateArrayInstances(part.array.instances);
      part.array = undefined;
    }
    updateRepeatChildPart(part, value as any);
    return;
  }

  const previousInstance = part.instance;
  const previousArray = part.array?.instances;

  if (part.repeat) {
    destroyRepeatBlocks(part.repeat, true);
    part.repeat = undefined;
    part.nodes.length = 0;
  }

  if (isPrimitiveChild(value) && updatePrimitiveChildPart(part, value)) {
    if (previousInstance) destroyTemplateInstance(previousInstance);
    destroyTemplateArrayInstances(previousArray);
    return;
  }

  if (updateTemplateArrayChildPart(part, value)) {
    if (previousInstance) destroyTemplateInstance(previousInstance);
    return;
  }

  if (part.instance && isTemplateResult(value) && part.instance.result.strings === value.strings) {
    updateTemplateInstance(part.instance, value);
    part.nodes = part.instance.nodes;
    destroyRepeatPart(part);
    destroyTemplateArrayInstances(previousArray);
    part.array = undefined;
    return;
  }

  const nodes = normalize(value as any);
  const parent = part.marker.parentNode;
  if (!parent) return;

  const instance = isTemplateResult(value)
    ? ((nodes as any).__litcodeInstance ?? findChildPartBefore(nodes, parent)?.instance)
    : undefined;

  if (previousInstance && previousInstance !== instance) destroyTemplateInstance(previousInstance);
  destroyTemplateArrayInstances(previousArray);

  resetChildPart(part, patchNodesBeforeMarker(parent, part.nodes, nodes, part.marker), instance);
}

function updateTemplateArrayChildPart(part: ChildPart, value: unknown): boolean {
  if (!Array.isArray(value)) return false;

  const length = value.length;
  for (let index = 0; index < length; index++) {
    if (!isTemplateResult(value[index])) return false;
  }

  const parent = part.marker.parentNode;
  if (!parent) return true;

  const current = part.array?.instances;

  if (current && current.length === length) {
    let canUpdate = true;
    for (let index = 0; index < length; index++) {
      if (current[index].result.strings !== value[index].strings) {
        canUpdate = false;
        break;
      }
    }

    if (canUpdate) {
      for (let index = 0; index < length; index++)
        updateTemplateInstance(current[index], value[index]);
      // Skip redundant part.nodes = collectInstanceNodes(current) allocation.
      // Top-level DOM nodes of template instances are static and never change their references or count.
      part.instance = undefined;
      part.repeat = undefined;
      return true;
    }
  }

  const previous = part.array?.instances;
  const instances = new Array<TemplateInstance>(length);
  const nodes: Node[] = [];

  for (let index = 0; index < length; index++) {
    const instance = instantiateTemplate(value[index]);
    instances[index] = instance;
    for (let nodeIndex = 0; nodeIndex < instance.nodes.length; nodeIndex++)
      nodes.push(instance.nodes[nodeIndex]);
  }

  const patchedNodes = patchNodesBeforeMarker(parent, part.nodes, nodes, part.marker);
  destroyTemplateArrayInstances(previous);

  part.nodes = patchedNodes;
  part.instance = undefined;
  part.array = { instances };
  part.repeat = undefined;
  return true;
}

export function updatePrimitiveChildPart(
  part: ChildPart,
  value: string | number | boolean | null | undefined,
): boolean {
  const parent = part.marker.parentNode;
  if (!parent) return true;

  if (value === null || value === undefined || value === false) {
    removeNodes(part.nodes);
    resetPrimitiveChildPart(part);
    return true;
  }

  const text = String(value);
  const current = part.nodes[0];

  if (current?.nodeType === Node.TEXT_NODE) {
    if (current.textContent !== text) current.textContent = text;

    if (part.nodes.length > 1) removeNodes(part.nodes, 1);

    resetPrimitiveChildPart(part, current);
    return true;
  }

  const next = document.createTextNode(text);
  parent.insertBefore(next, current ?? part.marker);

  removeNodes(part.nodes);

  resetPrimitiveChildPart(part, next);
  return true;
}

export function isPrimitiveChild(
  value: unknown,
): value is string | number | boolean | null | undefined {
  return (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function removeNodes(nodes: Node[], start = 0): void {
  for (let index = start; index < nodes.length; index++)
    nodes[index].parentNode?.removeChild(nodes[index]);
}

function resetPrimitiveChildPart(part: ChildPart, node?: Node): void {
  part.nodes.length = 0;
  if (node) part.nodes[0] = node;
  part.instance = undefined;
  part.array = undefined;
  part.repeat = undefined;
}

function isRepeatResult(value: any) {
  return value?.__litcodeRepeat === true;
}
