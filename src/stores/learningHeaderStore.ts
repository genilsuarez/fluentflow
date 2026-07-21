import { create } from 'zustand';
import type { LearningMode } from '../types';

interface LearningHeaderProgress {
  title: string;
  currentIndex: number;
  totalItems: number;
  mode: LearningMode;
}

interface LearningHeaderStore {
  progress: LearningHeaderProgress | null;
  setProgress: (progress: LearningHeaderProgress) => void;
  clearProgress: () => void;
}

export const useLearningHeaderStore = create<LearningHeaderStore>(set => ({
  progress: null,
  setProgress: progress => set({ progress }),
  clearProgress: () => set({ progress: null }),
}));
