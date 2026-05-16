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
import { updateChildPart } from './dom-child';
import * as patch from './patch';
import { $effect } from './runes';

let templateCacheDocument: Document | undefined;

export function getTemplateCacheEntry(strings: TemplateStringsArray, values: readonly unknown[]): TemplateCacheEntry {
  if (templateCacheDocument !== document) {
    templateCache.clear();
    templateCacheDocument = document;
  }

  const cacheKey = templateCacheKey(strings, values);
  let cached = templateCache.get(cacheKey);

  if (!cached) {
    const template = document.createElement('template');
    template.innerHTML = cacheKey;
    cached = {
      template,
      hasBooleanAttributes: booleanSelector ? !!template.content.querySelector(booleanSelector) : false,
      hasKeys: !!template.content.querySelector(keySelector),
    };
    templateCache.set(cacheKey, cached);
  }

  return cached;
}

export function instantiateTemplate(result: TemplateResult): TemplateInstance {
  const cached = getTemplateCacheEntry(result.strings, result.values);
  const fragment = domTemplateUtils.createFragmentFromCache(cached);
  const nodes = Array.from(fragment.childNodes);
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
      parts.push({ kind: 'event', index: staticPart.index, element: node as Element, name: staticPart.name });
      continue;
    }

    if (staticPart.kind === 'attribute') {
      parts.push({ kind: 'attribute', index: staticPart.index, element: node as Element, name: staticPart.name });
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
            if (!Object.is((part as AttributePart).value, resolvedValue)) {
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
        if (!Object.is((part as AttributePart).value, rawValue)) {
          setAttributeValue(part.element, (part as AttributePart).name, rawValue);
          (part as AttributePart).value = rawValue;
        }
      }
      continue;
    }

    if (part.kind === 'event') {
      const eventPart = part as EventPart;
      part.source = undefined;

      if (eventPart.value === rawValue) continue;

      eventPart.value = typeof rawValue === 'function' ? rawValue as EventListener : undefined;
      const element = eventPart.element as LitcodeElement;
      element.__litcodeEvents ??= {};
      element.__litcodeListeners ??= {};

      if (eventPart.value) {
        element.__litcodeEvents[eventPart.name] = eventPart.value;
        if (!eventPart.listener) {
          eventPart.listener = (event) => {
            const handler = (eventPart.element as LitcodeElement).__litcodeEvents?.[eventPart.name] ?? eventPart.value;
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
    const eventName = typeof value === 'function' ? domHelpers.eventNameFromAttribute(part) : undefined;

    if (eventName) {
      source += domHelpers.markerAttributeValue(part, `${markerPrefix}${index}`);
      continue;
    }

    const attributeName = domHelpers.isInsideTag(source) ? domHelpers.attributeNameFromAttribute(part) : undefined;

    if (attributeName) {
      source += domHelpers.markerAttributeValue(part, `${markerPrefix}${index}`);
      continue;
    }

    if (domHelpers.isInsideTag(source)) {
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
  const comments: Comment[] = [];

  while (walker.nextNode()) comments.push(walker.currentNode as Comment);

  for (let commentIndex = 0; commentIndex < comments.length; commentIndex++) {
    const comment = comments[commentIndex];
    const data = comment.data.trim();
    if (!data.startsWith(markerPrefix)) continue;

    parts.push({
      kind: 'child',
      index: Number(data.slice(markerPrefix.length)),
      path: domTemplateUtils.getNodePath(comment, root),
    });
  }

  for (let index = 0; index < result.values.length; index++) {
    const previous = result.strings[index];
    const eventName = typeof result.values[index] === 'function' ? domHelpers.eventNameFromAttribute(previous) : undefined;
    const attributeName = domHelpers.isInsideTag(previous) ? domHelpers.attributeNameFromAttribute(previous) : undefined;

    if (eventName) {
      root.querySelectorAll(`[on${eventName}="${markerPrefix}${index}"]`).forEach((element) => {
        parts.push({ kind: 'event', index, path: domTemplateUtils.getNodePath(element, root), name: eventName });
      });
      continue;
    }

    if (attributeName === 'key') {
      root.querySelectorAll(`[key="${markerPrefix}${index}"]`).forEach((element) => {
        parts.push({ kind: 'key', index, path: domTemplateUtils.getNodePath(element, root) });
      });
      continue;
    }

    if (attributeName) {
      root.querySelectorAll(`[${attributeName}="${markerPrefix}${index}"]`).forEach((element) => {
        parts.push({ kind: 'attribute', index, path: domTemplateUtils.getNodePath(element, root), name: attributeName });
      });
    }
  }

  cached.dynamicParts = parts;
  return parts;
}

function setAttributeValue(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name);
    if (booleanAttributes.has(name) && name in element) {
      (element as unknown as Record<string, boolean>)[name] = false;
    }
    return;
  }

  const attributeValue = value === true && booleanAttributes.has(name) ? '' : String(value);
  element.setAttribute(name, attributeValue);

  if (booleanAttributes.has(name) && name in element) {
    (element as unknown as Record<string, boolean>)[name] = true;
  }
}
