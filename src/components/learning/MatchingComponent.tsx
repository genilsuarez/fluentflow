import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Check, Info, X, Home } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useToast } from '../../hooks/useToast';
import { conditionalShuffle } from '../../utils/randomUtils';
import { useLearningCleanup } from '../../hooks/useLearningCleanup';
import { useTranslation } from '../../utils/i18n';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';

import '../../styles/components/matching-modal.css';
import '../../styles/components/matching-component.css';
import '../../styles/components/matching-component-override.css';
import '../../styles/components/game-controls.css';
import type { LearningModule } from '../../types';

interface MatchingComponentProps {
  module: LearningModule;
}

const MatchingComponent: React.FC<MatchingComponentProps> = ({ module }) => {
  const [leftItems, setLeftItems] = useState<string[]>([]);
  const [rightItems, setRightItems] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [startTime] = useState(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<any>(null);
  const currentModuleIdRef = useRef<string | null>(null);
  const pairsRef = useRef<{ left: string; right: string; explanation: string }[]>([]);

  const updateSessionScore = useAppStore(state => state.updateSessionScore);
  const { updateUserScore } = useUserStore();
  const { language, randomizeItems } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const { showCorrectAnswer, showIncorrectAnswer, showModuleCompleted } = useToast();
  const { t } = useTranslation(language);
  useLearningCleanup();

  const handleReturnToMenu = () => returnToMenu();

  // Initialize component when module changes
  // Body scroll management for modal - optimized to prevent double appearance
  useEffect(() => {
    if (showExplanation) {
      // Use requestAnimationFrame to sync with modal animation
      const scrollY = window.scrollY;

      // Apply scroll lock immediately but smoothly
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--scroll-y', `-${scrollY}px`);
        document.body.classList.add('modal-open');
      });

      return () => {
        // Smooth cleanup with animation frame
        document.body.classList.remove('modal-open');
        document.documentElement.style.removeProperty('--scroll-y');

        // Restore scroll position after a brief delay to prevent jump
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      };
    }
  }, [showExplanation]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showExplanation) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          setShowExplanation(false);
        }
      } else if (e.key === 'Escape') {
        returnToMenu();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showExplanation, returnToMenu]);

  useEffect(() => {
    if (!module?.data || !module?.id) return;
    if (currentModuleIdRef.current === module.id) return;

    currentModuleIdRef.current = module.id;

    // Expect data to be an array of {left, right, explanation} objects
    const initialPairs = (module.data as any[]).map((item: any) => ({
      left: item.left || '',
      right: item.right || '',
      explanation: item.explanation || '',
    }));

    // Store pairs in ref so they're stable across re-renders
    // (select in useModuleData can re-shuffle on each render)
    pairsRef.current = initialPairs;

    if (initialPairs.length > 0) {
      const terms = initialPairs.map((pair: { left: string; right: string }) => pair.left);
      const definitions = initialPairs.map((pair: { left: string; right: string }) => pair.right);

      setLeftItems(conditionalShuffle(terms, randomizeItems));
      setRightItems(conditionalShuffle(definitions, randomizeItems));

      setMatches({});
      setSelectedLeft(null);
      setSelectedRight(null);
      setShowResult(false);
    }
  }, [module?.data, module?.id, randomizeItems]);

  if (!module?.data || leftItems.length === 0) {
    return (
      <div className="matching-component">
        <div className="matching-component__loading">
          <p className="matching-component__loading-text">{t('learning.loadingMatching')}</p>
        </div>
      </div>
    );
  }

  // Use stable pairs from ref (set once during initialization)
  const pairs = pairsRef.current;

  const handleLeftClick = (item: string) => {
    if (showResult || matches[item]) return;

    if (selectedLeft === item) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(item);
      if (selectedRight) {
        createMatch(item, selectedRight);
      }
    }
  };

  const handleRightClick = (item: string) => {
    if (showResult || Object.values(matches).includes(item)) return;

    if (selectedRight === item) {
      setSelectedRight(null);
    } else {
      setSelectedRight(item);
      if (selectedLeft) {
        createMatch(selectedLeft, item);
      }
    }
  };

  const createMatch = (left: string, right: string) => {
    setMatches(prev => ({ ...prev, [left]: right }));
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const removeMatch = (leftItem: string) => {
    if (showResult) return;
    setMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[leftItem];
      return newMatches;
    });
  };

  const checkAnswers = () => {
    let correctMatches = 0;

    pairs.forEach((pair: { left: string; right: string }) => {
      if (matches[pair.left] === pair.right) {
        correctMatches++;
      }
    });

    const isAllCorrect = correctMatches === pairs.length;
    updateSessionScore(isAllCorrect ? { correct: 1 } : { incorrect: 1 });
    setShowResult(true);

    // Show toast feedback
    if (isAllCorrect) {
      showCorrectAnswer();
    } else {
      showIncorrectAnswer();
    }
  };

  const resetExercise = () => {
    const terms = pairs.map((pair: { left: string; right: string }) => pair.left);
    const definitions = pairs.map((pair: { left: string; right: string }) => pair.right);

    setLeftItems(conditionalShuffle(terms, randomizeItems));
    setRightItems(conditionalShuffle(definitions, randomizeItems));
    setMatches({});
    setSelectedLeft(null);
    setSelectedRight(null);
    setShowResult(false);
  };

  const finishExercise = () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const correctCount = pairs.filter(
      (pair: { left: string; right: string }) => matches[pair.left] === pair.right
    ).length;
    const finalScore = Math.round((correctCount / pairs.length) * 100);
    const accuracy = (correctCount / pairs.length) * 100;

    showModuleCompleted(module.name, finalScore, accuracy);
    updateUserScore(module.id, finalScore, timeSpent);
    returnToMenu({ autoScrollToNext: true });
  };

  const showSummaryModal = () => {
    setShowExplanation(false);
    setSelectedTerm(null);
    // Create a summary object with all pairs and their explanations
    const summaryData = {
      pairs: pairs,
      matches: matches,
      results: pairs.map(pair => ({
        ...pair,
        userAnswer: matches[pair.left] || t('learning.noAnswer'),
        isCorrect: matches[pair.left] === pair.right,
      })),
    };
    setSelectedTerm(summaryData);
    setShowExplanation(true);
  };

  const allMatched = Object.keys(matches).length === pairs.length;

  const getItemStatus = (item: string, isLeft: boolean) => {
    if (showResult) {
      if (isLeft) {
        const correctMatch = pairs.find(
          (pair: { left: string; right: string }) => pair.left === item
        )?.right;
        const userMatch = matches[item];
        return userMatch === correctMatch ? 'correct' : 'incorrect';
      } else {
        const correctPair = pairs.find(
          (pair: { left: string; right: string }) => pair.right === item
        );
        const userMatch = Object.entries(matches).find(([, right]) => right === item);
        if (correctPair && userMatch) {
          return userMatch[0] === correctPair.left ? 'correct' : 'incorrect';
        }
        return Object.values(matches).includes(item) ? 'incorrect' : 'unmatched';
      }
    }
    return 'normal';
  };

  return (
    <div className="matching-component">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={Object.keys(matches).length - 1}
        totalItems={pairs.length}
        mode="matching"
        helpText={allMatched ? t('learning.allMatched') : t('learning.clickToMatch')}
      />

      {/* Compact Matching Grid */}
      <div className="matching-component__grid">
        <div className="matching-component__columns">
          {/* Terms Column */}
          <div className="matching-component__column">
            <h3 className="matching-component__column-header">{t('learning.terms')}</h3>
            {leftItems.map((item, index) => {
              const isMatched = matches[item];
              const isSelected = selectedLeft === item;
              const status = getItemStatus(item, true);

              let className = 'matching-component__item ';

              if (showResult) {
                className +=
                  status === 'correct'
                    ? 'matching-component__item--correct'
                    : 'matching-component__item--incorrect';
              } else if (isMatched) {
                className += 'matching-component__item--matched';
              } else if (isSelected) {
                className += 'matching-component__item--selected';
              } else {
                className += 'matching-component__item--default';
              }

              return (
                <button
                  key={`left-${index}`}
                  onClick={() => (isMatched ? removeMatch(item) : handleLeftClick(item))}
                  className={`${className} matching-component__button matching-component__button--primary`}
                >
                  <div className="matching-component__item-content">
                    <span className="matching-component__item-letter">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="matching-component__item-text">
                      <ContentRenderer content={ContentAdapter.ensureStructured(item, 'quiz')} />
                    </span>
                    <div className="matching-component__item-actions">
                      {showResult && (
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            const termData = (module.data as any[])?.find(
                              (d: any) => d.left === item
                            );
                            setSelectedTerm(termData);
                            setShowExplanation(true);
                          }}
                          className="matching-component__info-button"
                          title={t('learning.showExplanation')}
                        >
                          <Info className="matching-component__info-icon" />
                        </div>
                      )}
                      {isMatched && (
                        <span className="matching-component__match-number">
                          {rightItems.findIndex(def => matches[item] === def) + 1}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Definitions Column */}
          <div className="matching-component__column">
            <h3 className="matching-component__column-header">{t('learning.definitions')}</h3>
            {rightItems.map((item, index) => {
              const isMatched = Object.values(matches).includes(item);
              const isSelected = selectedRight === item;
              const status = getItemStatus(item, false);

              let className = 'matching-component__item ';

              if (showResult) {
                className +=
                  status === 'correct'
                    ? 'matching-component__item--correct'
                    : status === 'incorrect'
                      ? 'matching-component__item--incorrect'
                      : 'matching-component__item--unmatched';
              } else if (isMatched) {
                className += 'matching-component__item--matched-inactive';
              } else if (isSelected) {
                className += 'matching-component__item--selected';
              } else {
                className += 'matching-component__item--default';
              }

              return (
                <button
                  key={`right-${index}`}
                  onClick={() => handleRightClick(item)}
                  disabled={isMatched && !showResult}
                  className={`${className} matching-component__button matching-component__button--secondary`}
                >
                  <div className="matching-component__item-content">
                    <span className="matching-component__item-letter matching-component__item-letter--orange">
                      {index + 1}
                    </span>
                    <span className="matching-component__item-text">
                      <ContentRenderer content={ContentAdapter.ensureStructured(item, 'quiz')} />
                    </span>
                    {isMatched && (
                      <span className="matching-component__item-letter">
                        {String.fromCharCode(
                          65 + leftItems.findIndex(term => matches[term] === item)
                        )}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unified Control Bar */}
      <div className="game-controls">
        {/* Home Navigation */}
        <button
          onClick={handleReturnToMenu}
          className="game-controls__home-btn"
          title={t('learning.returnToMainMenu')}
        >
          <Home className="game-controls__home-icon" />
        </button>

        {!showResult ? (
          <>
            <button
              onClick={resetExercise}
              className="game-controls__icon-btn"
              title={t('learning.resetExercise')}
            >
              <RotateCcw className="game-controls__action-icon" />
            </button>

            <button
              onClick={checkAnswers}
              disabled={!allMatched}
              className="game-controls__primary-btn game-controls__primary-btn--orange"
            >
              <Check className="game-controls__primary-icon" />
              <span>{t('learning.checkMatches')}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={showSummaryModal}
              className="game-controls__icon-btn"
              title={t('learning.viewSummary')}
            >
              <Info className="game-controls__action-icon" />
            </button>
            <button
              onClick={finishExercise}
              className="game-controls__primary-btn game-controls__primary-btn--green"
            >
              <Check className="game-controls__primary-icon" />
              <span>{t('learning.finishExercise')}</span>
            </button>
          </>
        )}
      </div>

      {/* Explanation/Summary Modal */}
      {showExplanation && selectedTerm && (
        <div className="matching-modal">
          <div className="matching-modal__container">
            <div className="matching-modal__content">
              <div className="matching-modal__header">
                <h3 className="matching-modal__title">
                  {selectedTerm.pairs
                    ? t('learning.exerciseSummary')
                    : t('learning.explanation').replace(':', '')}
                </h3>
                <button
                  onClick={() => setShowExplanation(false)}
                  className="matching-modal__close-btn"
                >
                  <X className="matching-modal__close-icon" />
                </button>
              </div>

              {selectedTerm.pairs ? (
                /* Summary View */
                <div className="matching-modal__summary">
                  <div className="matching-modal__results-grid">
                    {selectedTerm.results.map((result: any, index: number) => (
                      <div
                        key={index}
                        className={`matching-modal__result-card ${
                          result.isCorrect
                            ? 'matching-modal__result-card--correct'
                            : 'matching-modal__result-card--incorrect'
                        }`}
                      >
                        <span
                          className={`matching-modal__card-status ${
                            result.isCorrect
                              ? 'matching-modal__card-status--correct'
                              : 'matching-modal__card-status--incorrect'
                          }`}
                        >
                          {result.isCorrect ? '✓' : '✗'}
                        </span>

                        <h4 className="matching-modal__card-term"><ContentRenderer content={ContentAdapter.ensureStructured(result.left, 'quiz')} /></h4>

                        <p className="matching-modal__card-value matching-modal__card-value--correct">
                          <ContentRenderer content={ContentAdapter.ensureStructured(result.right, 'quiz')} />
                        </p>

                        {!result.isCorrect ? (
                          <p className="matching-modal__card-value matching-modal__card-value--incorrect">
                            <ContentRenderer content={ContentAdapter.ensureStructured(result.userAnswer, 'quiz')} />
                          </p>
                        ) : (
                          <span className="matching-modal__card-placeholder"></span>
                        )}

                        {result.explanation && (
                          <span className="matching-modal__card-explanation">
                            <ContentRenderer
                              content={ContentAdapter.ensureStructured(
                                result.explanation,
                                'explanation'
                              )}
                            />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Individual Explanation View - Card style */
                <div className="matching-modal__individual">
                  <div className="matching-modal__result-card matching-modal__result-card--correct">
                    <span className="matching-modal__card-status matching-modal__card-status--correct">
                      ✓
                    </span>
                    <h4 className="matching-modal__card-term"><ContentRenderer content={ContentAdapter.ensureStructured(selectedTerm.left, 'quiz')} /></h4>
                    <p className="matching-modal__card-value matching-modal__card-value--correct">
                      <ContentRenderer content={ContentAdapter.ensureStructured(selectedTerm.right, 'quiz')} />
                    </p>
                  </div>

                  {selectedTerm.explanation && (
                    <div className="matching-modal__detail-explanation">
                      <ContentRenderer
                        content={ContentAdapter.ensureStructured(
                          selectedTerm.explanation,
                          'explanation'
                        )}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="matching-modal__actions">
                <button
                  onClick={() => setShowExplanation(false)}
                  className="matching-modal__close-button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingComponent;
