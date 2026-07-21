/**
 * Input validation and sanitization utilities
 * Lightweight validation without external dependencies
 */

const isIntInRange = (v: unknown, min: number, max: number): boolean =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const validateMode = (
  obj: unknown,
  fields: Record<string, [number, number]>
): Record<string, number> | null => {
  if (!obj || typeof obj !== 'object') return null;
  const result: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(fields)) {
    const val = (obj as Record<string, unknown>)[key];
    if (!isIntInRange(val, min, max)) return null;
    result[key] = val as number;
  }
  return result;
};

const DEFAULTS = {
  flashcardMode: { wordCount: 8 },
  quizMode: { questionCount: 8 },
  completionMode: { itemCount: 8 },
  sortingMode: { wordCount: 4, categoryCount: 3 },
  matchingMode: { wordCount: 5 },
  reorderingMode: { itemCount: 8 },
  transformationMode: { itemCount: 8 },
  wordFormationMode: { itemCount: 8 },
  errorCorrectionMode: { itemCount: 8 },
};

/**
 * Validate game settings object
 * @param settings - Game settings to validate
 * @returns Validated and sanitized settings
 */
export const validateGameSettings = (settings: unknown): typeof DEFAULTS => {
  if (!settings || typeof settings !== 'object') return DEFAULTS;
  const s = settings as Record<string, unknown>;

  const modes: Record<string, Record<string, [number, number]>> = {
    flashcardMode: { wordCount: [1, 50] },
    quizMode: { questionCount: [1, 50] },
    completionMode: { itemCount: [1, 50] },
    sortingMode: { wordCount: [1, 50], categoryCount: [2, 10] },
    matchingMode: { wordCount: [2, 50] },
    reorderingMode: { itemCount: [1, 50] },
    transformationMode: { itemCount: [1, 50] },
    wordFormationMode: { itemCount: [1, 50] },
    errorCorrectionMode: { itemCount: [1, 50] },
  };

  const result: Record<string, Record<string, number>> = {};
  for (const [mode, fields] of Object.entries(modes)) {
    const validated = validateMode(s[mode], fields);
    if (!validated) return DEFAULTS;
    result[mode] = validated;
  }

  return result as typeof DEFAULTS;
};
