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

export function slugFromEntryHref(href?: string | null): string {
  if (!href) return '';
  const match = href.match(/\/collections\/stories\/entries\/([^/?#]+)/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

const PUBLIC_MEDIA = /^\/stories\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;
const REPO_MEDIA = /^public\/stories\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function publicMediaToRepoPath(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  const match = trimmed.match(PUBLIC_MEDIA);
  if (!match) return null;
  return `public/stories/${match[1]}`;
}

export function isRideMediaRepoPath(path?: string | null): boolean {
  return REPO_MEDIA.test(path || '');
}

/** Cover, gallery, and inline /stories/ photos from a markdown file. */
export function mediaRepoPathsFromText(raw: string): string[] {
  const paths = new Set<string>();
  const re = /\/stories\/[A-Za-z0-9][A-Za-z0-9._-]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw || ''))) {
    const repo = publicMediaToRepoPath(match[0]);
    if (repo) paths.add(repo);
  }
  return [...paths];
}

export function unusedMediaPaths(fromDeleted: string[], stillUsed: string[]): string[] {
  const used = new Set(stillUsed.filter(isRideMediaRepoPath));
  return [...new Set(fromDeleted.filter(isRideMediaRepoPath))].filter((path) => !used.has(path));
}

export function slugFromRideName(name?: string | null): string {
  const folded = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  if (!folded || /[./]/.test(folded)) return '';
  return folded;
}

export function uniqueRideSlug(base: string, existingPaths: readonly string[]): string {
  const safe = slugFromRideName(base);
  if (!safe) return '';
  const taken = new Set(
    existingPaths.map((path) => slugFromRidePath(path)).filter(Boolean),
  );
  if (!taken.has(safe)) return safe;
  for (let n = 2; n < 100; n++) {
    const candidate = `${safe}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return '';
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

export function todayStamp(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function newRideMarkdown(title: string, pubDate = todayStamp()): string {
  const name = title.trim() || 'New ride';
  return [
    '---',
    `title: ${yamlQuote(name)}`,
    `headline: ${yamlQuote(name)}`,
    'description: "Write a few lines about this ride."',
    `pubDate: ${pubDate}`,
    'order: 0',
    'draft: false',
    'gallery: []',
    '---',
    '',
    '',
  ].join('\n');
}

