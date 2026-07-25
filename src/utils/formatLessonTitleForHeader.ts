const COMPACT_TITLE_LENGTH = 30;

const TITLE_SPLIT_SEPARATORS = [' — ', ' · ', ' – ', ' | ', ' / '] as const;

function trySplitTitle(title: string): string[] | null {
  for (const separator of TITLE_SPLIT_SEPARATORS) {
    const index = title.indexOf(separator);
    if (index <= 0) continue;

    const line1 = title.slice(0, index).trim();
    const line2 = title.slice(index + separator.length).trim();
    if (line1 && line2) return [line1, line2];
  }

  const parenIndex = title.indexOf(' (');
  if (parenIndex > 10 && parenIndex < title.length - 4) {
    return [title.slice(0, parenIndex).trim(), title.slice(parenIndex + 1).trim()];
  }

  return null;
}

export function formatLessonTitleForHeader(title: string): {
  displayLines: string[];
  isCompact: boolean;
} {
  const trimmed = title.trim();
  if (!trimmed) return { displayLines: [], isCompact: false };

  const isCompact = trimmed.length > COMPACT_TITLE_LENGTH;
  if (!isCompact) return { displayLines: [trimmed], isCompact: false };

  const split = trySplitTitle(trimmed);
  if (split) return { displayLines: split, isCompact: true };

  return { displayLines: [trimmed], isCompact: true };
}
