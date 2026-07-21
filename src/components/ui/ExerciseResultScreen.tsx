import React from 'react';
import { RotateCcw, ArrowRight, Trophy, Target, AlertTriangle, LayoutGrid } from 'lucide-react';
import '../../styles/components/exercise-result-screen.css';

export interface ExerciseResult {
  score: number;
  accuracy: number;
  correct: number;
  total: number;
  moduleName: string;
}

interface ExerciseResultScreenProps {
  result: ExerciseResult;
  onRetry: () => void;
  onContinue: () => void;
  t: (key: string) => string;
}

const PASS_THRESHOLD = 70;

const ExerciseResultScreen: React.FC<ExerciseResultScreenProps> = ({
  result,
  onRetry,
  onContinue,
  t,
}) => {
  const passed = result.accuracy >= PASS_THRESHOLD;

  // Enter key triggers the primary action (Continue if passed, Retry if failed)
  // Uses capture phase + stopImmediatePropagation to take priority over
  // parent component keydown listeners that remain active.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (passed) {
          onContinue();
        } else {
          onRetry();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [passed, onContinue, onRetry]);

  const getIcon = () => {
    if (result.accuracy >= 90) return <Trophy className="exercise-result__icon-svg" />;
    if (result.accuracy >= PASS_THRESHOLD) return <Target className="exercise-result__icon-svg" />;
    return <AlertTriangle className="exercise-result__icon-svg" />;
  };

  const getTitle = () => {
    if (result.accuracy >= 90) return t('exerciseResult.excellent');
    if (result.accuracy >= PASS_THRESHOLD) return t('exerciseResult.goodJob');
    if (result.accuracy >= 50) return t('exerciseResult.keepPracticing');
    return t('exerciseResult.needsWork');
  };

  return (
    <div className="exercise-result" role="alert" aria-live="polite">
      <div className={`exercise-result__card exercise-result__card--${passed ? 'pass' : 'fail'}`}>
        <div className={`exercise-result__icon exercise-result__icon--${passed ? 'pass' : 'fail'}`}>
          {getIcon()}
        </div>

        <h2 className="exercise-result__title">{getTitle()}</h2>
        <p className="exercise-result__module">{result.moduleName}</p>

        <div className="exercise-result__score">
          <span
            className={`exercise-result__percentage exercise-result__percentage--${passed ? 'pass' : 'fail'}`}
          >
            {result.accuracy.toFixed(0)}%
          </span>
        </div>

        <div className="exercise-result__stats">
          <div className="exercise-result__stat">
            <span className="exercise-result__stat-value exercise-result__stat-value--correct">
              {result.correct}
            </span>
            <span className="exercise-result__stat-label">{t('exerciseResult.correct')}</span>
          </div>
          <div className="exercise-result__stat-divider" />
          <div className="exercise-result__stat">
            <span className="exercise-result__stat-value exercise-result__stat-value--incorrect">
              {result.total - result.correct}
            </span>
            <span className="exercise-result__stat-label">{t('exerciseResult.incorrect')}</span>
          </div>
        </div>

        {!passed && <p className="exercise-result__hint">{t('exerciseResult.retryHint')}</p>}

        <div className="exercise-result__actions">
          {!passed ? (
            <>
              <button
                onClick={onRetry}
                className="exercise-result__btn exercise-result__btn--primary"
              >
                <RotateCcw className="exercise-result__btn-icon" />
                <span>{t('exerciseResult.retry')}</span>
              </button>
              <button
                onClick={onContinue}
                className="exercise-result__btn exercise-result__btn--secondary"
              >
                <LayoutGrid className="exercise-result__btn-icon" aria-hidden="true" />
                <span>{t('exerciseResult.backToMenu')}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onContinue}
                className="exercise-result__btn exercise-result__btn--primary exercise-result__btn--success"
              >
                <ArrowRight className="exercise-result__btn-icon" />
                <span>{t('exerciseResult.continue')}</span>
              </button>
              <button
                onClick={onRetry}
                className="exercise-result__btn exercise-result__btn--secondary"
              >
                <RotateCcw className="exercise-result__btn-icon" />
                <span>{t('exerciseResult.retry')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseResultScreen;
