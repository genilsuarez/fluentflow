/**
 * Content Adapter - Migration utility for gradual transition
 * Allows components to use new ContentRenderer while maintaining backward compatibility
 */

import { ContentParser } from './contentParser';
import type { StructuredContent } from '../types/content';
import type { QuizData, FlashcardData } from '../types';

export class ContentAdapter {
  /**
   * Convert legacy quiz data to structured content
   */
  static adaptQuizData(quizData: QuizData): {
    question: StructuredContent;
    explanation?: StructuredContent;
  } {
    const questionText = quizData.question || quizData.sentence || quizData.idiom || '';

    return {
      question: ContentParser.parseQuizContent(questionText),
      explanation: quizData.explanation
        ? ContentParser.parseExplanationContent(quizData.explanation)
        : undefined,
    };
  }

  /**
   * Convert legacy flashcard data to structured content
   */
  static adaptFlashcardData(flashcardData: FlashcardData): {
    front: StructuredContent;
    back: StructuredContent;
    example?: StructuredContent;
  } {
    return {
      front: ContentParser.parseFlashcardContent(flashcardData.front),
      back: ContentParser.parseFlashcardContent(flashcardData.back),
      example: flashcardData.example
        ? ContentParser.parseFlashcardContent(flashcardData.example)
        : undefined,
    };
  }

  /**
   * Generic string to structured content conversion
   */
  static adaptString(
    text: string,
    format: 'quiz' | 'flashcard' | 'explanation' | 'reading' | 'completion' = 'quiz'
  ): StructuredContent {
    return ContentParser.fromLegacyString(text, format);
  }

  /**
   * Check if content is already structured
   */
  static isStructuredContent(content: any): content is StructuredContent {
    return (
      content &&
      typeof content === 'object' &&
      Array.isArray(content.segments) &&
      content.segments.every(
        (segment: any) =>
          segment &&
          typeof segment === 'object' &&
          typeof segment.type === 'string' &&
          typeof segment.content === 'string'
      )
    );
  }

  /**
   * Ensure content is structured (convert if needed)
   */
  static ensureStructured(
    content: string | StructuredContent,
    format: 'quiz' | 'flashcard' | 'explanation' | 'reading' | 'completion' = 'quiz'
  ): StructuredContent {
    if (this.isStructuredContent(content)) {
      return content;
    }

    if (typeof content === 'string') {
      return this.adaptString(content, format);
    }

    // Fallback for invalid content
    return {
      segments: [{ type: 'text', content: 'Invalid content' }],
      format,
    };
  }
}
