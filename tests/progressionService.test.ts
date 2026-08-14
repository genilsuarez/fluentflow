// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionService } from '../src/services/progressionService';
import type { LearningModule } from '../src/types';

describe('ProgressionService', () => {
  let progressionService: ProgressionService;
  let mockModules: LearningModule[];

  beforeEach(() => {
    progressionService = new ProgressionService();

    // Create mock modules with prerequisites
    mockModules = [
      {
        id: 'module-a1-1',
        name: 'Basic Vocabulary',
        learningMode: 'flashcard',
        level: ['a1'],
        category: 'Vocabulary',
        unit: 1,
        prerequisites: [],
        estimatedTime: 5,
        difficulty: 1,
      },
      {
        id: 'module-a1-2',
        name: 'Basic Grammar',
        learningMode: 'matching',
        level: ['a1'],
        category: 'Grammar',
        unit: 1,
        prerequisites: ['module-a1-1'],
        estimatedTime: 5,
        difficulty: 1,
      },
      {
        id: 'module-a2-1',
        name: 'Family Vocabulary',
        learningMode: 'flashcard',
        level: ['a2'],
        category: 'Vocabulary',
        unit: 2,
        prerequisites: ['module-a1-2'],
        estimatedTime: 5,
        difficulty: 2,
      },
    ];

    progressionService.initialize(mockModules, []);
  });

  describe('isModuleUnlocked', () => {
    it('should unlock modules with no prerequisites', () => {
      expect(progressionService.isModuleUnlocked('module-a1-1')).toBe(true);
    });

    it('should lock modules with unmet prerequisites', () => {
      expect(progressionService.isModuleUnlocked('module-a1-2')).toBe(false);
      expect(progressionService.isModuleUnlocked('module-a2-1')).toBe(false);
    });

    it('should unlock modules when prerequisites are completed', () => {
      progressionService.completeModule('module-a1-1');
      expect(progressionService.isModuleUnlocked('module-a1-2')).toBe(true);
      expect(progressionService.isModuleUnlocked('module-a2-1')).toBe(false);
    });
  });

  describe('completeModule', () => {
    it('should return newly unlocked modules when completing a module', () => {
      const newlyUnlocked = progressionService.completeModule('module-a1-1');
      expect(newlyUnlocked).toHaveLength(1);
      expect(newlyUnlocked[0].id).toBe('module-a1-2');
    });

    it('should not return already unlocked modules', () => {
      progressionService.completeModule('module-a1-1');
      const newlyUnlocked = progressionService.completeModule('module-a1-1');
      expect(newlyUnlocked).toHaveLength(0);
    });
  });

  describe('getProgressionStats', () => {
    it('should return correct progression statistics', () => {
      const stats = progressionService.getProgressionStats();
      expect(stats.totalModules).toBe(3);
      expect(stats.completedModules).toBe(0);
      expect(stats.unlockedModules).toBe(1); // Only module-a1-1
      expect(stats.lockedModules).toBe(2);
      expect(stats.completionPercentage).toBe(0);
    });

    it('should update statistics after completing modules', () => {
      progressionService.completeModule('module-a1-1');
      const stats = progressionService.getProgressionStats();
      expect(stats.completedModules).toBe(1);
      expect(stats.unlockedModules).toBe(2); // module-a1-1 completed, module-a1-2 unlocked
      expect(stats.lockedModules).toBe(1);
      expect(stats.completionPercentage).toBe(33); // 1/3 * 100
    });

    it('should keep total completed aligned with unit stats', () => {
      progressionService.completeModule('module-a1-1');
      progressionService.completeModule('module-a1-2');
      const stats = progressionService.getProgressionStats();
      const unitSum = stats.unitStats.reduce((sum, unit) => sum + unit.completed, 0);
      expect(stats.completedModules).toBe(unitSum);
    });
  });

  describe('skip-ahead completions', () => {
    let multiLevelService: ProgressionService;
    let multiLevelModules: LearningModule[];

    beforeEach(() => {
      multiLevelService = new ProgressionService();
      multiLevelModules = [
        {
          id: 'a1-only',
          name: 'A1 Module',
          learningMode: 'flashcard',
          level: ['a1'],
          category: 'Vocabulary',
          unit: 1,
          prerequisites: [],
          estimatedTime: 5,
          difficulty: 1,
        },
        {
          id: 'a2-valid',
          name: 'A2 Module',
          learningMode: 'flashcard',
          level: ['a2'],
          category: 'Vocabulary',
          unit: 2,
          prerequisites: [],
          estimatedTime: 5,
          difficulty: 2,
        },
        {
          id: 'b1-incomplete',
          name: 'B1 Module',
          learningMode: 'flashcard',
          level: ['b1'],
          category: 'Vocabulary',
          unit: 3,
          prerequisites: [],
          estimatedTime: 5,
          difficulty: 3,
        },
        {
          id: 'b2-skip',
          name: 'B2 Skip',
          learningMode: 'flashcard',
          level: ['b2'],
          category: 'Vocabulary',
          unit: 4,
          prerequisites: [],
          estimatedTime: 5,
          difficulty: 4,
        },
      ];
      multiLevelService.initialize(multiLevelModules, ['a1-only', 'a2-valid', 'b2-skip']);
    });

    it('should not count completions above an incomplete previous level', () => {
      const stats = multiLevelService.getProgressionStats();
      expect(stats.completedModules).toBe(2);
      expect(stats.unitStats.find(unit => unit.unit === 4)?.completed).toBe(0);
    });
  });

  describe('getUnitCompletionStatus', () => {
    it('should return correct unit completion status', () => {
      const unit1Status = progressionService.getUnitCompletionStatus(1);
      expect(unit1Status.total).toBe(2);
      expect(unit1Status.completed).toBe(0);
      expect(unit1Status.percentage).toBe(0);
      expect(unit1Status.allCompleted).toBe(false);
    });

    it('should update unit status after completing modules', () => {
      progressionService.completeModule('module-a1-1');
      progressionService.completeModule('module-a1-2');

      const unit1Status = progressionService.getUnitCompletionStatus(1);
      expect(unit1Status.total).toBe(2);
      expect(unit1Status.completed).toBe(2);
      expect(unit1Status.percentage).toBe(100);
      expect(unit1Status.allCompleted).toBe(true);
    });
  });

  describe('cross-app lp-level gate', () => {
    let crossAppService: ProgressionService;
    let crossAppModules: LearningModule[];

    beforeEach(() => {
      localStorage.clear();
      crossAppService = new ProgressionService();
      crossAppModules = [
        {
          id: 'a1-only',
          name: 'A1 Module',
          learningMode: 'flashcard',
          level: ['a1'],
          category: 'Vocabulary',
          unit: 1,
          prerequisites: [],
          estimatedTime: 5,
          difficulty: 1,
        },
        {
          id: 'a2-only',
          name: 'A2 Module',
          learningMode: 'flashcard',
          level: ['a2'],
          category: 'Vocabulary',
          unit: 2,
          prerequisites: [],
          estimatedTime: 5,
          difficulty: 2,
        },
      ];
      // FluentFlow's own A1 is fully complete — this alone must NOT unlock A2.
      crossAppService.initialize(crossAppModules, ['a1-only']);
    });

    it('should keep next-level modules locked when lp-level has not caught up, even if FluentFlow finished its own previous level', () => {
      expect(localStorage.getItem('lp-level')).toBeNull();
      expect(crossAppService.isModuleUnlocked('a2-only')).toBe(false);
    });

    it('should unlock next-level modules once lp-level (combined FluentFlow+HubFlow+LyricFlow) reaches that level', () => {
      localStorage.setItem('lp-level', 'a2');
      expect(crossAppService.isModuleUnlocked('a2-only')).toBe(true);
    });

    it('should default missing lp-level to a1 without blocking a1-level modules', () => {
      expect(localStorage.getItem('lp-level')).toBeNull();
      expect(crossAppService.isModuleUnlocked('a1-only')).toBe(true);
    });
  });

  describe('getMissingPrerequisites', () => {
    it('should return missing prerequisites for locked modules', () => {
      const missing = progressionService.getMissingPrerequisites('module-a1-2');
      expect(missing).toHaveLength(1);
      expect(missing[0].id).toBe('module-a1-1');
    });

    it('should return empty array for unlocked modules', () => {
      const missing = progressionService.getMissingPrerequisites('module-a1-1');
      expect(missing).toHaveLength(0);
    });
  });
});
