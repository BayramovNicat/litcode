export function isInsideTag(source: string): boolean {
  return source.lastIndexOf('<') > source.lastIndexOf('>');
}

export function eventNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s(on[a-z][\w-]*)\s*=\s*["']?$/i);
  return match?.[1]?.slice(2).toLowerCase();
}

export function attributeNameFromAttribute(source: string): string | undefined {
  const match = source.match(/\s([:@a-zA-Z_][\w:.-]*)\s*=\s*["']?$/);
  return match?.[1];
}

export function markerAttributeValue(source: string, id: string): string {
  return /["']$/.test(source.trimEnd()) ? id : `"${id}"`;
}

export function escapeAttribute(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
