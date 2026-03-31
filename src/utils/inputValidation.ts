/**
 * Input validation and sanitization utilities
 */

import { z } from 'zod';

// Validation schemas
const gameSettingsSchema = z.object({
  flashcardMode: z.object({
    wordCount: z.number().int().min(1).max(50),
  }),
  quizMode: z.object({
    questionCount: z.number().int().min(1).max(50),
  }),
  completionMode: z.object({
    itemCount: z.number().int().min(1).max(50),
  }),
  sortingMode: z.object({
    wordCount: z.number().int().min(1).max(50),
    categoryCount: z.number().int().min(2).max(10),
  }),
  matchingMode: z.object({
    wordCount: z.number().int().min(2).max(50),
  }),
  reorderingMode: z.object({
    itemCount: z.number().int().min(1).max(50),
  }),
});

/**
 * Validate game settings object
 * @param settings - Game settings to validate
 * @returns Validated and sanitized settings
 */
export const validateGameSettings = (settings: any): any => {
  try {
    return gameSettingsSchema.parse(settings);
  } catch {
    // Return safe defaults
    return {
      flashcardMode: { wordCount: 10 },
      quizMode: { questionCount: 10 },
      completionMode: { itemCount: 10 },
      sortingMode: { wordCount: 5, categoryCount: 3 },
      matchingMode: { wordCount: 6 },
      reorderingMode: { itemCount: 10 },
    };
  }
};
