export function isInsideTag(source: string): boolean {
  return source.lastIndexOf('<') > source.lastIndexOf('>');
}

export function eventNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s(on[a-z][\w-]*)\s*=\s*(?:["'])?$/i);
  return match?.[1]?.slice(2).toLowerCase();
}

export function attributeNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s([:@a-zA-Z_][\w:.-]*)\s*=\s*(?:["'])?$/);
  return match?.[1];
}

export function markerAttributeValue(id: string): string {
  return id;
}

export function escapeAttribute(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getClassValue(element: Element): string {
  if (element.namespaceURI === 'http://www.w3.org/2000/svg') {
    return element.getAttribute('class') ?? '';
  }

  return (element as HTMLElement).className;
}

export function setClassValue(element: Element, value: string): void {
  if (element.namespaceURI === 'http://www.w3.org/2000/svg') {
    element.setAttribute('class', value);
    return;
  }

  (element as HTMLElement).className = value;
}
