import { type TemplateResult } from './types';
import {
  type TemplateCacheEntry,
  type StaticPart,
  type ChildPart,
  type AttributePart,
  type EventPart,
  type LitcodeElement,
  type Part,
  type TemplateInstance,
  booleanAttributes,
  templateCache,
  booleanSelector,
  keySelector,
  markerPrefix,
} from './template';
import * as domHelpers from './dom-helpers';
import * as domTemplateUtils from './dom-template-utils';
import { updateChildPart, updatePrimitiveChildPart } from './dom-child';
import { $effect } from './runes';

let templateCacheDocument: Document | undefined;

export function getTemplateCacheEntry(
  strings: TemplateStringsArray,
  values: readonly unknown[],
): TemplateCacheEntry {
  if (templateCacheDocument !== document) {
    templateCache.clear();
    templateCacheDocument = document;
  }

  const cacheKey = templateCacheKey(strings, values);
  let cached = templateCache.get(cacheKey);

  if (!cached) {
    const template = document.createElement('template');
    template.innerHTML = cacheKey;

    const hasBooleanAttributes = booleanSelector
      ? Array.from(template.content.querySelectorAll(booleanSelector)).some((el) => {
          for (const attribute of booleanAttributes) {
            if (el.getAttribute(attribute) === '') return true;
          }
          return false;
        })
      : false;

    const hasKeys = Array.from(template.content.querySelectorAll(keySelector)).some((el) => {
      const key = el.getAttribute('key');
      return key !== null && !key.startsWith(markerPrefix);
    });

    cached = {
      template,
      hasBooleanAttributes,
      hasKeys,
    };
    templateCache.set(cacheKey, cached);
  }

  return cached;
}

export function instantiateTemplate(result: TemplateResult): TemplateInstance {
  const cached = getTemplateCacheEntry(result.strings, result.values);
  const fragment = domTemplateUtils.createFragmentFromCache(cached);
  const nodes = childNodesToArray(fragment);
  const parts: Part[] = [];
  const staticParts = getTemplateParts(cached, result);

  for (let index = 0; index < staticParts.length; index++) {
    const staticPart = staticParts[index];
    const node = domTemplateUtils.pathToNode(fragment, staticPart.path);
    if (!node) continue;

    if (staticPart.kind === 'child') {
      const part: ChildPart = {
        kind: 'child',
        index: staticPart.index,
        marker: node as Comment,
        nodes: [],
      };

      (node as Comment & { __litcodePart?: ChildPart }).__litcodePart = part;
      parts.push(part);
      continue;
    }

    if (staticPart.kind === 'event') {
      parts.push({
        kind: 'event',
        index: staticPart.index,
        element: node as Element,
        name: staticPart.name,
      });
      continue;
    }

    if (staticPart.kind === 'attribute') {
      parts.push({
        kind: 'attribute',
        index: staticPart.index,
        element: node as Element,
        name: staticPart.name,
      });
      continue;
    }

    parts.push({ kind: 'key', index: staticPart.index, element: node as any });
  }

  const instance = { result, fragment, parts, nodes };
  updateTemplateInstance(instance, result);
  return instance;
}

export function updateTemplateInstance(instance: TemplateInstance, next: TemplateResult): void {
  const parts = instance.parts;
  const values = next.values;
  const resultChanged = instance.result !== next;

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const rawValue = values[part.index];

    if (part.kind === 'child') {
      if (
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean' ||
        rawValue === null ||
        rawValue === undefined
      ) {
        if (part.cleanup) {
          part.cleanup();
          part.cleanup = undefined;
        }
        part.source = undefined;
        const childPart = part as ChildPart;
        if (childPart.instance || childPart.repeat || childPart.array) {
          updateChildPart(childPart, rawValue);
        } else {
          updatePrimitiveChildPart(childPart, rawValue);
        }
        continue;
      }

      let isRuneVal = false;
      let isReactiveFn = false;

      if (rawValue !== null && rawValue !== undefined) {
        if (typeof rawValue === 'object') {
          if ((rawValue as any).__litcodeRune === true) isRuneVal = true;
        } else if (typeof rawValue === 'function') {
          isReactiveFn = true;
        }
      }

      if (isRuneVal || isReactiveFn) {
        if (part.source !== rawValue || (resultChanged && isRuneVal)) {
          part.cleanup?.();
          part.cleanup = undefined;
          part.source = rawValue;
          part.cleanup = $effect(() => {
            const resolvedValue = isRuneVal ? (rawValue as any).value : (rawValue as Function)();
            updateChildPart(part as ChildPart, resolvedValue);
          });
        }
      } else {
        if (part.cleanup) {
          part.cleanup();
          part.cleanup = undefined;
        }
        part.source = undefined;
        updateChildPart(part as ChildPart, rawValue);
      }
      continue;
    }

    if (part.kind === 'attribute') {
      if (
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean' ||
        rawValue === null ||
        rawValue === undefined
      ) {
        if (part.cleanup) {
          part.cleanup();
          part.cleanup = undefined;
        }
        part.source = undefined;
        if ((part as AttributePart).value !== rawValue) {
          setAttributeValue(part.element, (part as AttributePart).name, rawValue);
          (part as AttributePart).value = rawValue;
        }
        continue;
      }

      let isRuneVal = false;
      let isReactiveFn = false;

      if (rawValue !== null && rawValue !== undefined) {
        if (typeof rawValue === 'object') {
          if ((rawValue as any).__litcodeRune === true) isRuneVal = true;
        } else if (typeof rawValue === 'function') {
          isReactiveFn = true;
        }
      }

      if (isRuneVal || isReactiveFn) {
        if (part.source !== rawValue || (resultChanged && isRuneVal)) {
          part.cleanup?.();
          part.cleanup = undefined;
          part.source = rawValue;
          part.cleanup = $effect(() => {
            const resolvedValue = isRuneVal ? (rawValue as any).value : (rawValue as Function)();
            if ((part as AttributePart).value !== resolvedValue) {
              setAttributeValue(part.element, (part as AttributePart).name, resolvedValue);
              (part as AttributePart).value = resolvedValue;
            }
          });
        }
      } else {
        if (part.cleanup) {
          part.cleanup();
          part.cleanup = undefined;
        }
        part.source = undefined;
        if ((part as AttributePart).value !== rawValue) {
          setAttributeValue(part.element, (part as AttributePart).name, rawValue);
          (part as AttributePart).value = rawValue;
        }
      }
      continue;
    }

    if (part.kind === 'event') {
      const eventPart = part as EventPart;
      part.source = undefined;
      eventPart.element.removeAttribute(`on${eventPart.name}`);

      if (eventPart.value === rawValue) continue;

      eventPart.value = typeof rawValue === 'function' ? (rawValue as EventListener) : undefined;
      const element = eventPart.element as LitcodeElement;
      element.__litcodeEvents ??= {};
      element.__litcodeListeners ??= {};

      if (eventPart.value) {
        element.__litcodeEvents[eventPart.name] = eventPart.value;
        if (!eventPart.listener) {
          eventPart.listener = (event) => {
            const handler =
              (eventPart.element as LitcodeElement).__litcodeEvents?.[eventPart.name] ??
              eventPart.value;
            handler?.(event);
          };
          element.__litcodeListeners[eventPart.name] = eventPart.listener;
          eventPart.element.addEventListener(eventPart.name, eventPart.listener);
        }
      } else if (eventPart.listener) {
        delete element.__litcodeEvents[eventPart.name];
        delete element.__litcodeListeners[eventPart.name];
        eventPart.element.removeEventListener(eventPart.name, eventPart.listener);
        eventPart.listener = undefined;
      } else {
        delete element.__litcodeEvents[eventPart.name];
        delete element.__litcodeListeners[eventPart.name];
      }
      continue;
    }

    (part.element as any).__litcodeKey = String(rawValue);
    part.source = undefined;
    part.element.removeAttribute('key');
  }

  instance.result = next;
}

export function destroyTemplateInstance(instance: TemplateInstance): void {
  for (let index = 0; index < instance.parts.length; index++) {
    const part = instance.parts[index];
    part.cleanup?.();
    part.cleanup = undefined;
    part.source = undefined;

    if (part.kind === 'event') {
      const eventPart = part as EventPart;
      eventPart.value = undefined;
    }

    if (part.kind === 'child') {
      const childPart = part as ChildPart;
      if (childPart.instance) destroyTemplateInstance(childPart.instance);
      if (childPart.array) {
        for (let arrayIndex = 0; arrayIndex < childPart.array.instances.length; arrayIndex++) {
          destroyTemplateInstance(childPart.array.instances[arrayIndex]);
        }
      }
      if (childPart.repeat) {
        for (let b = 0; b < childPart.repeat.blocks.length; b++) {
          const block = childPart.repeat.blocks[b];
          block.cleanup?.();
          if (block.instance) destroyTemplateInstance(block.instance);
        }
      }
    }
  }
}

function templateCacheKey(strings: TemplateStringsArray, values: readonly unknown[]): string {
  let source = '';

  for (let index = 0; index < strings.length; index++) {
    const part = strings[index];
    source += part;
    if (index >= values.length) continue;

    const value = values[index];
    const eventName = domHelpers.eventNameFromAttribute(part);

    if (eventName) {
      source += domHelpers.markerAttributeValue(`${markerPrefix}${index}`);
      continue;
    }

    const attributeName = domHelpers.isInsideTag(source)
      ? domHelpers.attributeNameFromAttribute(part)
      : undefined;

    if (attributeName) {
      source += domHelpers.markerAttributeValue(`${markerPrefix}${index}`);
      continue;
    }

    if (domHelpers.isInsideTag(source)) {
      const unquotedAttributeName = domHelpers.unquotedAttributeNameFromAttribute(part);

      if (unquotedAttributeName) {
        throw new TypeError(
          `Dynamic attribute "${unquotedAttributeName}" must be quoted. Use ${unquotedAttributeName}="\${value}" instead of ${unquotedAttributeName}=\${value}.`,
        );
      }

      source += domHelpers.escapeAttribute(value);
      continue;
    }

    source += `<!--${markerPrefix}${index}-->`;
  }

  return source.trim();
}

function getTemplateParts(cached: TemplateCacheEntry, result: TemplateResult): StaticPart[] {
  if (cached.dynamicParts) return cached.dynamicParts;

  const root = cached.template.content;
  const parts: StaticPart[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);

  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment;
    const data = comment.data.trim();
    if (!data.startsWith(markerPrefix)) continue;

    parts.push({
      kind: 'child',
      index: Number(data.slice(markerPrefix.length)),
      path: domTemplateUtils.getNodePath(comment, root),
    });
  }

  type AttributePartDescriptor =
    | 'key'
    | { kind: 'attribute'; name: string }
    | { kind: 'event'; name: string };

  const attributeParts = new Map<number, AttributePartDescriptor>();
  let source = '';

  for (let index = 0; index < result.values.length; index++) {
    const previous = result.strings[index];
    source += previous;
    const eventName = domHelpers.eventNameFromAttribute(previous);
    const attributeName = domHelpers.isInsideTag(source)
      ? domHelpers.attributeNameFromAttribute(previous)
      : undefined;

    if (eventName) {
      source += domHelpers.markerAttributeValue(`${markerPrefix}${index}`);
      attributeParts.set(index, { kind: 'event', name: eventName });
      continue;
    }

    if (attributeName === 'key') {
      source += domHelpers.markerAttributeValue(`${markerPrefix}${index}`);
      attributeParts.set(index, 'key');
      continue;
    }

    if (attributeName) {
      source += domHelpers.markerAttributeValue(`${markerPrefix}${index}`);
      attributeParts.set(index, { kind: 'attribute', name: attributeName });
      continue;
    }

    if (domHelpers.isInsideTag(source)) {
      source += domHelpers.escapeAttribute(result.values[index]);
    } else {
      source += `<!--${markerPrefix}${index}-->`;
    }
  }

  if (attributeParts.size > 0) {
    const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

    while (elementWalker.nextNode()) {
      const element = elementWalker.currentNode as Element;
      const attributes = element.attributes;
      let path: number[] | undefined;

      for (let attrIndex = 0; attrIndex < attributes.length; attrIndex++) {
        const markerIndex = markerIndexFromAttributeValue(attributes[attrIndex].value);
        if (markerIndex === undefined) continue;

        const part = attributeParts.get(markerIndex);
        if (!part) continue;

        path ??= domTemplateUtils.getNodePath(element, root);

        if (part === 'key') {
          parts.push({ kind: 'key', index: markerIndex, path });
          continue;
        }

        parts.push({
          kind: part.kind,
          index: markerIndex,
          path,
          name: part.name,
        });
      }
    }
  }

  cached.dynamicParts = parts;
  return parts;
}

function markerIndexFromAttributeValue(value: string): number | undefined {
  if (!value.startsWith(markerPrefix)) return undefined;

  const index = Number(value.slice(markerPrefix.length));
  return Number.isInteger(index) ? index : undefined;
}

function setAttributeValue(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    if (name === 'value' && 'value' in element) {
      (element as HTMLInputElement).value = '';
    } else if (name === 'class') {
      element.className = '';
    } else {
      element.removeAttribute(name);
      if (booleanAttributes.has(name) && name in element) {
        (element as unknown as Record<string, boolean>)[name] = false;
      }
    }
    return;
  }

  if (name === 'value' && 'value' in element) {
    const nextVal = String(value);
    if ((element as HTMLInputElement).value !== nextVal) {
      (element as HTMLInputElement).value = nextVal;
    }
    return;
  }

  if (name === 'checked' && 'checked' in element) {
    const nextVal = !!value;
    if ((element as HTMLInputElement).checked !== nextVal) {
      (element as HTMLInputElement).checked = nextVal;
    }
    return;
  }

  const attributeValue = value === true && booleanAttributes.has(name) ? '' : String(value);

  if (name === 'class') {
    if (element.className !== attributeValue) {
      element.className = attributeValue;
    }
    return;
  }

  element.setAttribute(name, attributeValue);

  if (booleanAttributes.has(name) && name in element) {
    (element as unknown as Record<string, boolean>)[name] = true;
  }
}

function childNodesToArray(parent: Node): Node[] {
  const childNodes = parent.childNodes;
  const nodes = new Array<Node>(childNodes.length);

  for (let index = 0; index < childNodes.length; index++) nodes[index] = childNodes[index];

  return nodes;
}
