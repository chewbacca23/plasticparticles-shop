export function isRideMarkdownPath(path?: string | null): boolean {
  if (!path) return false;
  return /^src\/content\/stories\/[^./][^/]*\.md$/.test(path);
}

/** Prefer headline, then title, then the filename slug. */
export function rideLabelFromMarkdown(raw: string, fallback: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return fallback;
  const block = match[1];
  const headline = block.match(/^headline:\s*(.*)$/m)?.[1];
  const title = block.match(/^title:\s*(.*)$/m)?.[1];
  const value = (headline || title || '').trim().replace(/^["']|["']$/g, '');
  return value || fallback;
}

export function slugFromRidePath(path: string): string {
  return path.replace(/^src\/content\/stories\//, '').replace(/\.md$/, '');
}
