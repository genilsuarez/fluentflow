/**
 * Content Rendering System Types
 * Structured approach to content that separates data from presentation
 */

type ContentSegmentType =
  | 'text' // Regular text
  | 'term' // Highlighted terms (previously quoted text)
  | 'emphasis' // Bold/italic text
  | 'code' // Code snippets
  | 'variable' // Variables or placeholders
  | 'link'; // Links or references

export interface ContentSegment {
  type: ContentSegmentType;
  content: string;
  metadata?: {
    language?: string;
    pronunciation?: string;
    definition?: string;
    [key: string]: any;
  };
}

export interface StructuredContent {
  segments: ContentSegment[];
  format?: 'quiz' | 'flashcard' | 'explanation' | 'plain' | 'reading' | 'completion';
  metadata?: {
    difficulty?: number;
    focus?: string[];
    [key: string]: any;
  };
}
