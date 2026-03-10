/**
 * Content Parser - Converts string patterns to structured content
 * Replaces HTML-in-JSON approach with semantic content structure
 */

import type { ContentSegment, StructuredContent } from '../types/content';

export class ContentParser {
  /**
   * Parse quiz content with various formatting patterns
   * Patterns:
   * - "quoted text" -> term segments (primary)
   * - 'quoted text' -> term segments (legacy, with contraction detection)
   * - **bold text** -> emphasis segments
   * - `code text` -> code segments
   * - {{variable}} -> variable segments
   */
  static parseQuizContent(text: string): StructuredContent {
    if (!text || typeof text !== 'string') {
      return { segments: [{ type: 'text', content: '' }], format: 'quiz' };
    }

    const segments: ContentSegment[] = [];
    let currentIndex = 0;

    // Patterns to match (order matters for precedence)
    const patterns = [
      { regex: /<([^>]+)>/g, type: 'term' as const }, // Modern: angle brackets (primary)
      { regex: /"([^"]+)"/g, type: 'term' as const }, // Legacy: double quotes
      { regex: /'([^']+)'/g, type: 'term' as const, validator: ContentParser.isValidTerm }, // Legacy: single quotes
      { regex: /\*\*([^*]+)\*\*/g, type: 'emphasis' as const },
      { regex: /`([^`]+)`/g, type: 'code' as const },
      { regex: /\{\{([^}]+)\}\}/g, type: 'variable' as const },
    ];

    // Find all matches with their positions
    const matches: Array<{
      start: number;
      end: number;
      content: string;
      type: ContentSegment['type'];
    }> = [];

    patterns.forEach(({ regex, type, validator }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const content = match[1]; // Captured group (content without delimiters)

        // Apply validator if present (for legacy single quotes)
        if (validator && !validator(content)) {
          continue; // Skip this match if validation fails
        }

        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          content,
          type,
        });
      }
    });

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build segments
    matches.forEach(match => {
      // Add text before this match
      if (currentIndex < match.start) {
        const textContent = text.slice(currentIndex, match.start);
        if (textContent) {
          segments.push({ type: 'text', content: textContent });
        }
      }

      // Add the matched segment
      segments.push({ type: match.type, content: match.content });
      currentIndex = match.end;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      if (remainingText) {
        segments.push({ type: 'text', content: remainingText });
      }
    }

    // If no patterns matched, return the whole text as a single segment
    if (segments.length === 0) {
      segments.push({ type: 'text', content: text });
    }

    return {
      segments,
      format: 'quiz',
    };
  }

  /**
   * Parse flashcard content (simpler patterns)
   */
  static parseFlashcardContent(text: string): StructuredContent {
    // For now, flashcards use simpler parsing
    // Can be enhanced later with specific patterns
    return {
      segments: [{ type: 'text', content: text }],
      format: 'flashcard',
    };
  }

  /**
   * Parse explanation content with rich formatting
   */
  static parseExplanationContent(text: string): StructuredContent {
    // Similar to quiz content but with different emphasis
    const result = this.parseQuizContent(text);
    return {
      ...result,
      format: 'explanation',
    };
  }

  /**
   * Validate if a term should be highlighted (not a contraction)
   * @private
   */
  private static isValidTerm(content: string): boolean {
    // Skip empty content
    if (!content) {
      return false;
    }

    // Check against common English contractions first
    if (ContentParser.isContraction(content)) {
      return false;
    }

    // Check for possessives (words ending with 's but not contractions)
    if (content.endsWith("'s") || content.endsWith("s'")) {
      return false;
    }

    // Allow single letters (like 'I', 'a') and vocabulary words
    return /^[a-zA-Z\s-]+$/.test(content);
  }

  /**
   * Check if text is a common English contraction
   * @private
   */
  private static isContraction(text: string): boolean {
    const contractions = new Set([
      // Common contractions (lowercase for case-insensitive matching)
      "i'm",
      "you're",
      "he's",
      "she's",
      "it's",
      "we're",
      "they're",
      "i'll",
      "you'll",
      "he'll",
      "she'll",
      "it'll",
      "we'll",
      "they'll",
      "i'd",
      "you'd",
      "he'd",
      "she'd",
      "it'd",
      "we'd",
      "they'd",
      "can't",
      "won't",
      "don't",
      "doesn't",
      "didn't",
      "haven't",
      "hasn't",
      "hadn't",
      "shouldn't",
      "wouldn't",
      "couldn't",
      "isn't",
      "aren't",
      "wasn't",
      "weren't",
      "let's",
      "that's",
      "what's",
      "where's",
      "when's",
      "why's",
      "how's",
      "who's",
      "there's",
      "here's",
    ]);

    return contractions.has(text.toLowerCase());
  }

  /**
   * Parse reading content with formatting patterns.
   * Reading content uses double quotes for terms (no single-quote ambiguity).
   */
  static parseReadingContent(text: string): StructuredContent {
    if (!text || typeof text !== 'string') {
      return { segments: [{ type: 'text', content: '' }], format: 'reading' };
    }

    const segments: ContentSegment[] = [];
    let currentIndex = 0;

    // Reading uses only double quotes for terms (single quotes are apostrophes)
    const patterns = [
      { regex: /<([^>]+)>/g, type: 'term' as const },
      { regex: /"([^"]+)"/g, type: 'term' as const },
      { regex: /\*\*([^*]+)\*\*/g, type: 'emphasis' as const },
      { regex: /`([^`]+)`/g, type: 'code' as const },
      { regex: /\{\{([^}]+)\}\}/g, type: 'variable' as const },
    ];

    const matches: Array<{
      start: number;
      end: number;
      content: string;
      type: ContentSegment['type'];
    }> = [];

    patterns.forEach(({ regex, type }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
          type,
        });
      }
    });

    matches.sort((a, b) => a.start - b.start);

    matches.forEach(match => {
      if (currentIndex < match.start) {
        const textContent = text.slice(currentIndex, match.start);
        if (textContent) {
          segments.push({ type: 'text', content: textContent });
        }
      }
      segments.push({ type: match.type, content: match.content });
      currentIndex = match.end;
    });

    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      if (remainingText) {
        segments.push({ type: 'text', content: remainingText });
      }
    }

    if (segments.length === 0) {
      segments.push({ type: 'text', content: text });
    }

    return { segments, format: 'reading' };
  }

  /**
   * Legacy compatibility: convert current string content to structured
   */
  static fromLegacyString(
    text: string,
    format: 'quiz' | 'flashcard' | 'explanation' | 'reading' = 'quiz'
  ): StructuredContent {
    switch (format) {
      case 'quiz':
        return this.parseQuizContent(text);
      case 'flashcard':
        return this.parseFlashcardContent(text);
      case 'explanation':
        return this.parseExplanationContent(text);
      case 'reading':
        return this.parseReadingContent(text);
      default:
        return { segments: [{ type: 'text', content: text }], format };
    }
  }
}
