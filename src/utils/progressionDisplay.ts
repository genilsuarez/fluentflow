// Shared display helpers for the progression dashboard and its "continue
// learning" hero — split out from ProgressionDashboard.tsx so that file can
// export only the component (react-refresh/only-export-components).

export const MODE_I18N_KEYS: Record<string, string> = {
  flashcard: 'learning.flashcardMode',
  quiz: 'learning.quizMode',
  completion: 'learning.completionMode',
  sorting: 'learning.sortingMode',
  matching: 'learning.matchingMode',
  reading: 'learning.readingMode',
  reordering: 'learning.reorderingMode',
  transformation: 'learning.transformationMode',
  'word-formation': 'learning.wordFormationMode',
  'error-correction': 'learning.errorCorrectionMode',
};

/** Emoji slot for resumen hero (homologated with HubFlow hero-card__icon) */
export const MODE_ICONS: Record<string, string> = {
  flashcard: '🃏',
  quiz: '❓',
  reading: '📖',
  matching: '🔗',
  sorting: '📋',
  completion: '✍️',
  reordering: '🔀',
  transformation: '🔄',
  'word-formation': '📝',
  'error-correction': '✏️',
  'listening-quiz': '🎧',
  dictation: '🎙️',
  'listen-complete': '🔊',
};

export function getModeIcon(mode: string): string {
  return MODE_ICONS[mode] || '📚';
}

export const getLevelColor = (level: string): string => {
  const colors = {
    a1: '#10b981', // green
    a2: '#3b82f6', // blue
    b1: '#f59e0b', // amber
    b2: '#ef4444', // red
    c1: '#8b5cf6', // violet
    c2: '#ec4899', // pink
  };
  return colors[level as keyof typeof colors] || '#6b7280';
};

/** Split "Mode: Exercise title" into type label + display title for hero cards */
export function splitModuleDisplayName(name: string): { title: string; typeLabel: string | null } {
  const colonIdx = name.indexOf(':');
  if (colonIdx === -1) return { title: name, typeLabel: null };
  const typeLabel = name.slice(0, colonIdx).trim();
  const title = name.slice(colonIdx + 1).trim();
  if (!title) return { title: name, typeLabel: null };
  return { title, typeLabel: typeLabel || null };
}
