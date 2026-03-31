// Core Types
export type LearningMode =
  | 'flashcard'
  | 'quiz'
  | 'completion'
  | 'sorting'
  | 'matching'
  | 'reading'
  | 'reordering'
  | 'transformation'
  | 'word-formation'
  | 'error-correction';
type DifficultyLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
export type Category = 'Vocabulary' | 'Grammar' | 'PhrasalVerbs' | 'Idioms' | 'Reading' | 'Review';

export interface LearningModule {
  id: string;
  name: string;
  description?: string;
  learningMode: LearningMode;
  level: DifficultyLevel[] | DifficultyLevel;
  category: Category;
  unit: number; // 1-6 (Foundation → Mastery)
  prerequisites: string[]; // IDs of required modules
  tags?: string[];
  data?: LearningData[];
  dataPath?: string;
  estimatedTime?: number;
  difficulty?: number;
}

// Base interface for all learning data types
interface BaseLearningData {
  id: string;
  category?: Category;
  level?: DifficultyLevel;
}

// Specific data types for different learning modes
export interface FlashcardData extends BaseLearningData {
  front: string;
  back: string;
  ipa?: string;
  hint?: string;
  example?: string;
  example_es?: string;
}

export interface QuizData extends BaseLearningData {
  question?: string;
  sentence?: string; // For sentence-based quizzes
  idiom?: string; // For idiom quizzes
  options: string[];
  correct: number | string;
  explanation?: string;
}

export interface CompletionData extends BaseLearningData {
  sentence: string;
  correct: string;
  missing?: string;
  options?: string[];
  hint?: string;
  tip?: string;
  explanation?: string;
}

export interface SortingData extends BaseLearningData {
  word: string;
  category: Category;
  subcategory?: string;
}

interface MatchingData extends BaseLearningData {
  left: string;
  right: string;
  explanation?: string;
  type?: 'word-definition' | 'word-translation' | 'question-answer';
  pairs?: { left: string; right: string }[];
}

// Reading mode types
export interface ReadingData extends BaseLearningData {
  title: string;
  sections: ReadingSection[];
  learningObjectives: string[];
  keyVocabulary: KeyTerm[];
  grammarPoints?: GrammarPoint[];
  estimatedReadingTime: number; // in minutes
}

interface ReadingSection {
  id: string;
  title: string;
  content: string;
  type: 'introduction' | 'theory' | 'examples' | 'summary';
  interactive?: ReadingInteractive;
}

interface ReadingInteractive {
  highlights?: string[];
  tooltips?: ReadingTooltip[];
  expandable?: ReadingExpandable[];
}

interface ReadingTooltip {
  term: string;
  definition: string;
}

interface ReadingExpandable {
  title: string;
  content: string;
}

interface KeyTerm {
  term: string;
  definition: string;
  example: string;
  pronunciation?: string; // IPA notation
}

interface GrammarPoint {
  rule: string;
  explanation: string;
  examples: string[];
  commonMistakes?: string[];
}

export interface ReorderingData extends BaseLearningData {
  sentence: string;
  words: string[];
  distractors?: string[];
  hint?: string;
  explanation?: string;
}

export interface TransformationData extends BaseLearningData {
  prompt: string;
  source: string;
  correct: string[];
  hint?: string;
  explanation?: string;
}

export interface WordFormationData extends BaseLearningData {
  sentence: string;
  rootWord: string;
  correct: string;
  hint?: string;
  explanation?: string;
}

export interface ErrorCorrectionData extends BaseLearningData {
  sentence: string;
  correct: string[];
  hint?: string;
  explanation?: string;
}

// Union type for all learning data
type LearningData =
  | FlashcardData
  | QuizData
  | CompletionData
  | SortingData
  | MatchingData
  | ReadingData
  | ReorderingData
  | TransformationData
  | WordFormationData
  | ErrorCorrectionData;

// Language and Theme types
export type Language = 'en' | 'es';
export type Theme = 'light' | 'dark';

// User & Auth
export interface User {
  id: string;
  name: string;
}

// Scoring & Progress
export interface SessionScore {
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
}

export interface ModuleScore {
  moduleId: string;
  bestScore: number;
  attempts: number;
  lastAttempt: string;
  timeSpent: number;
}

// App State
type AppView = 'menu' | LearningMode;
export type MenuContext = 'progression' | 'list';

export interface AppState {
  currentModule: LearningModule | null;
  currentView: AppView;
  previousMenuContext: MenuContext;
  sessionScore: SessionScore;
  globalScore: SessionScore;
  isLoading: boolean;
  error: string | null;
}

// Settings types — removed GameModeSettings, GameSettings (duplicated in settingsStore.ts)

// Toast types — removed ToastType, Toast (duplicated in toastStore.ts)

// Validation types — removed ValidationResult, ValidationConfig (unused)

// API Response types — removed ApiError, ApiResponse (duplicated in api.ts)
