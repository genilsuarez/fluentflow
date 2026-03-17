import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, ArrowRight, Home } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../utils/i18n';
import { useToast } from '../../hooks/useToast';
import { useLearningCleanup } from '../../hooks/useLearningCleanup';
import { conditionalShuffle } from '../../utils/randomUtils';
import '../../styles/components/completion-component.css';
import '../../styles/components/editable-input.css';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';
import { EditableInput } from '../ui/EditableInput';
import type { EditableInputHandle } from '../ui/EditableInput';

import type { LearningModule } from '../../types';

/**
 * Detect if the user's answer is a tense/conjugation variant of the correct answer.
 * Returns true when the words share a root but differ in form (e.g. "bring up" vs "brought up").
 */
function isTenseError(userAnswer: string, correctAnswer: string): boolean {
  const u = userAnswer.toLowerCase().trim();
  const c = correctAnswer.toLowerCase().trim();
  if (u === c) return false;

  // Common irregular verb mappings (base → past/participle forms and vice versa)
  const irregularForms: Record<string, string[]> = {
    bring: ['brought', 'bringing', 'brings'],
    buy: ['bought', 'buying', 'buys'],
    catch: ['caught', 'catching', 'catches'],
    come: ['came', 'coming', 'comes'],
    do: ['did', 'done', 'doing', 'does'],
    drink: ['drank', 'drunk', 'drinking', 'drinks'],
    drive: ['drove', 'driven', 'driving', 'drives'],
    eat: ['ate', 'eaten', 'eating', 'eats'],
    fall: ['fell', 'fallen', 'falling', 'falls'],
    feel: ['felt', 'feeling', 'feels'],
    find: ['found', 'finding', 'finds'],
    get: ['got', 'gotten', 'getting', 'gets'],
    give: ['gave', 'given', 'giving', 'gives'],
    go: ['went', 'gone', 'going', 'goes'],
    grow: ['grew', 'grown', 'growing', 'grows'],
    have: ['had', 'having', 'has'],
    hear: ['heard', 'hearing', 'hears'],
    hold: ['held', 'holding', 'holds'],
    keep: ['kept', 'keeping', 'keeps'],
    know: ['knew', 'known', 'knowing', 'knows'],
    leave: ['left', 'leaving', 'leaves'],
    let: ['letting', 'lets'],
    lie: ['lay', 'lain', 'lying', 'lies'],
    lose: ['lost', 'losing', 'loses'],
    make: ['made', 'making', 'makes'],
    meet: ['met', 'meeting', 'meets'],
    pay: ['paid', 'paying', 'pays'],
    put: ['putting', 'puts'],
    read: ['reading', 'reads'],
    run: ['ran', 'running', 'runs'],
    say: ['said', 'saying', 'says'],
    see: ['saw', 'seen', 'seeing', 'sees'],
    sell: ['sold', 'selling', 'sells'],
    send: ['sent', 'sending', 'sends'],
    set: ['setting', 'sets'],
    show: ['showed', 'shown', 'showing', 'shows'],
    sit: ['sat', 'sitting', 'sits'],
    speak: ['spoke', 'spoken', 'speaking', 'speaks'],
    stand: ['stood', 'standing', 'stands'],
    take: ['took', 'taken', 'taking', 'takes'],
    teach: ['taught', 'teaching', 'teaches'],
    tell: ['told', 'telling', 'tells'],
    think: ['thought', 'thinking', 'thinks'],
    throw: ['threw', 'thrown', 'throwing', 'throws'],
    turn: ['turned', 'turning', 'turns'],
    understand: ['understood', 'understanding', 'understands'],
    wake: ['woke', 'woken', 'waking', 'wakes'],
    wear: ['wore', 'worn', 'wearing', 'wears'],
    win: ['won', 'winning', 'wins'],
    write: ['wrote', 'written', 'writing', 'writes'],
    look: ['looked', 'looking', 'looks'],
    pick: ['picked', 'picking', 'picks'],
    break: ['broke', 'broken', 'breaking', 'breaks'],
    choose: ['chose', 'chosen', 'choosing', 'chooses'],
    cut: ['cutting', 'cuts'],
    draw: ['drew', 'drawn', 'drawing', 'draws'],
    fly: ['flew', 'flown', 'flying', 'flies'],
    forget: ['forgot', 'forgotten', 'forgetting', 'forgets'],
    hang: ['hung', 'hanging', 'hangs'],
    hide: ['hid', 'hidden', 'hiding', 'hides'],
    hit: ['hitting', 'hits'],
    lead: ['led', 'leading', 'leads'],
    lend: ['lent', 'lending', 'lends'],
    light: ['lit', 'lighting', 'lights'],
    mean: ['meant', 'meaning', 'means'],
    ride: ['rode', 'ridden', 'riding', 'rides'],
    ring: ['rang', 'rung', 'ringing', 'rings'],
    rise: ['rose', 'risen', 'rising', 'rises'],
    shake: ['shook', 'shaken', 'shaking', 'shakes'],
    shine: ['shone', 'shining', 'shines'],
    shoot: ['shot', 'shooting', 'shoots'],
    shut: ['shutting', 'shuts'],
    sing: ['sang', 'sung', 'singing', 'sings'],
    sink: ['sank', 'sunk', 'sinking', 'sinks'],
    sleep: ['slept', 'sleeping', 'sleeps'],
    slide: ['slid', 'sliding', 'slides'],
    spend: ['spent', 'spending', 'spends'],
    split: ['splitting', 'splits'],
    spread: ['spreading', 'spreads'],
    steal: ['stole', 'stolen', 'stealing', 'steals'],
    stick: ['stuck', 'sticking', 'sticks'],
    strike: ['struck', 'striking', 'strikes'],
    swim: ['swam', 'swum', 'swimming', 'swims'],
    swing: ['swung', 'swinging', 'swings'],
    tear: ['tore', 'torn', 'tearing', 'tears'],
    blow: ['blew', 'blown', 'blowing', 'blows'],
    build: ['built', 'building', 'builds'],
    burn: ['burnt', 'burned', 'burning', 'burns'],
    dig: ['dug', 'digging', 'digs'],
    feed: ['fed', 'feeding', 'feeds'],
    fight: ['fought', 'fighting', 'fights'],
    freeze: ['froze', 'frozen', 'freezing', 'freezes'],
    lay: ['laid', 'laying', 'lays'],
    lean: ['leant', 'leaned', 'leaning', 'leans'],
    learn: ['learnt', 'learned', 'learning', 'learns'],
    spell: ['spelt', 'spelled', 'spelling', 'spells'],
    spill: ['spilt', 'spilled', 'spilling', 'spills'],
    sweep: ['swept', 'sweeping', 'sweeps'],
    begin: ['began', 'begun', 'beginning', 'begins'],
    bend: ['bent', 'bending', 'bends'],
    bet: ['betting', 'bets'],
    bite: ['bit', 'bitten', 'biting', 'bites'],
    bleed: ['bled', 'bleeding', 'bleeds'],
    bind: ['bound', 'binding', 'binds'],
    breed: ['bred', 'breeding', 'breeds'],
    burst: ['bursting', 'bursts'],
    cast: ['casting', 'casts'],
    cling: ['clung', 'clinging', 'clings'],
    cost: ['costing', 'costs'],
    creep: ['crept', 'creeping', 'creeps'],
    deal: ['dealt', 'dealing', 'deals'],
    dream: ['dreamt', 'dreamed', 'dreaming', 'dreams'],
    dwell: ['dwelt', 'dwelling', 'dwells'],
    flee: ['fled', 'fleeing', 'flees'],
    fling: ['flung', 'flinging', 'flings'],
    forbid: ['forbade', 'forbidden', 'forbidding', 'forbids'],
    forgive: ['forgave', 'forgiven', 'forgiving', 'forgives'],
    grind: ['ground', 'grinding', 'grinds'],
    kneel: ['knelt', 'kneeling', 'kneels'],
    leap: ['leapt', 'leaped', 'leaping', 'leaps'],
    seek: ['sought', 'seeking', 'seeks'],
    sew: ['sewed', 'sewn', 'sewing', 'sews'],
    shed: ['shedding', 'sheds'],
    shrink: ['shrank', 'shrunk', 'shrinking', 'shrinks'],
    slay: ['slew', 'slain', 'slaying', 'slays'],
    sow: ['sowed', 'sown', 'sowing', 'sows'],
    spin: ['spun', 'spinning', 'spins'],
    spit: ['spat', 'spitting', 'spits'],
    spring: ['sprang', 'sprung', 'springing', 'springs'],
    sting: ['stung', 'stinging', 'stings'],
    stink: ['stank', 'stunk', 'stinking', 'stinks'],
    stride: ['strode', 'stridden', 'striding', 'strides'],
    strive: ['strove', 'striven', 'striving', 'strives'],
    swear: ['swore', 'sworn', 'swearing', 'swears'],
    weave: ['wove', 'woven', 'weaving', 'weaves'],
    weep: ['wept', 'weeping', 'weeps'],
    wind: ['wound', 'winding', 'winds'],
    wring: ['wrung', 'wringing', 'wrings'],
  };

  // Build a reverse lookup: any form → base form
  const formToBase = new Map<string, string>();
  for (const [base, forms] of Object.entries(irregularForms)) {
    formToBase.set(base, base);
    for (const form of forms) {
      formToBase.set(form, base);
    }
  }

  // Extract words from phrasal verbs (e.g., "bring up" → ["bring", "up"])
  const uWords = u.split(/\s+/);
  const cWords = c.split(/\s+/);

  // For phrasal verbs: check if the particle(s) match and only the verb differs
  if (uWords.length === cWords.length && uWords.length >= 2) {
    const uParticles = uWords.slice(1).join(' ');
    const cParticles = cWords.slice(1).join(' ');
    if (uParticles === cParticles) {
      const uBase = formToBase.get(uWords[0]);
      const cBase = formToBase.get(cWords[0]);
      if (uBase && cBase && uBase === cBase) return true;
    }
  }

  // For single words: check if they share the same base
  if (uWords.length === 1 && cWords.length === 1) {
    const uBase = formToBase.get(uWords[0]);
    const cBase = formToBase.get(cWords[0]);
    if (uBase && cBase && uBase === cBase) return true;

    // Fallback: regular verb detection (e.g., "walk" vs "walked")
    const uWord = uWords[0];
    const cWord = cWords[0];
    if (cWord.endsWith('ed') && cWord.startsWith(uWord)) return true;
    if (uWord.endsWith('ed') && uWord.startsWith(cWord)) return true;
    if (cWord.endsWith('ing') && (cWord.startsWith(uWord) || cWord.slice(0, -3) === uWord)) return true;
    if (uWord.endsWith('ing') && (uWord.startsWith(cWord) || uWord.slice(0, -3) === cWord)) return true;
  }

  return false;
}

/**
 * Detect if the user's answer uses the correct verb but the wrong particle.
 * E.g. "check out" vs "check in", "turn off" vs "turn on".
 */
function isParticleError(userAnswer: string, correctAnswer: string): boolean {
  const u = userAnswer.toLowerCase().trim();
  const c = correctAnswer.toLowerCase().trim();
  if (u === c) return false;

  const uWords = u.split(/\s+/);
  const cWords = c.split(/\s+/);

  // Both must be phrasal verbs (verb + particle(s))
  if (uWords.length < 2 || cWords.length < 2) return false;

  // Same verb, different particle(s)
  if (uWords[0] === cWords[0]) {
    const uParticle = uWords.slice(1).join(' ');
    const cParticle = cWords.slice(1).join(' ');
    return uParticle !== cParticle;
  }

  return false;
}

interface CompletionData {
  sentence: string;
  correct: string;
  explanation?: string;
  tip?: string;
}

interface CompletionComponentProps {
  module: LearningModule;
}

const CompletionComponent: React.FC<CompletionComponentProps> = ({ module }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [startTime] = useState(Date.now());
  const inputRef = useRef<EditableInputHandle>(null);
  // Flag to ignore Enter key briefly after advancing to next question
  const ignoreEnterRef = useRef(false);

  const updateSessionScore = useAppStore(state => state.updateSessionScore);
  const { updateUserScore } = useUserStore();
  const { language, randomizeItems } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();

  // Compute exercises once on mount — ref prevents re-shuffling on score updates
  const processedExercisesRef = useRef<CompletionData[] | null>(null);
  if (processedExercisesRef.current === null) {
    processedExercisesRef.current = module?.data
      ? conditionalShuffle(module.data as CompletionData[], randomizeItems)
      : [];
  }
  const processedExercises = processedExercisesRef.current;

  const { addProgressEntry } = useProgressStore();
  const { t } = useTranslation(language);
  const { showCorrectAnswer, showIncorrectAnswer, showModuleCompleted } = useToast();
  useLearningCleanup();

  const handleReturnToMenu = () => returnToMenu();

  const currentExercise = processedExercises[currentIndex];

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const checkAnswer = useCallback(() => {
    if (showResult) return;

    const userAnswer = answer.toLowerCase().trim();
    const correctAnswer = currentExercise?.correct?.toLowerCase().trim() || '';
    const isCorrect = userAnswer === correctAnswer;

    updateSessionScore(isCorrect ? { correct: 1 } : { incorrect: 1 });
    setShowResult(true);

    // Show toast feedback
    if (isCorrect) {
      showCorrectAnswer();
    } else {
      showIncorrectAnswer();
    }
  }, [
    showResult,
    answer,
    currentExercise?.correct,
    updateSessionScore,
    showCorrectAnswer,
    showIncorrectAnswer,
  ]);

  const handleNext = useCallback(() => {
    if (currentIndex < processedExercises.length - 1) {
      // Imperatively clear the contentEditable div BEFORE state updates
      // so the old text doesn't carry over (isFocused guard in useEffect would skip it)
      inputRef.current?.clear();
      setCurrentIndex(currentIndex + 1);
      setAnswer('');
      setShowResult(false);
      // Block Enter for a short window so the keyup of the same Enter
      // doesn't immediately trigger checkAnswer on the new question
      ignoreEnterRef.current = true;
      setTimeout(() => {
        ignoreEnterRef.current = false;
        requestAnimationFrame(() => inputRef.current?.focus());
      }, 150);
    } else {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const { sessionScore } = useAppStore.getState();
      const finalScore = Math.round((sessionScore.correct / sessionScore.total) * 100);

      // Register progress
      addProgressEntry({
        score: finalScore,
        totalQuestions: sessionScore.total,
        correctAnswers: sessionScore.correct,
        moduleId: module.id,
        learningMode: 'completion',
        timeSpent: timeSpent,
      });

      const accuracy = sessionScore.accuracy;
      showModuleCompleted(module.name, finalScore, accuracy);
      updateUserScore(module.id, finalScore, timeSpent);
      returnToMenu({ autoScrollToNext: true });
    }
  }, [
    currentIndex,
    processedExercises.length,
    startTime,
    addProgressEntry,
    module.id,
    module.name,
    showModuleCompleted,
    updateUserScore,
    returnToMenu,
  ]);

  useEffect(() => {
    if (processedExercises.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (ignoreEnterRef.current) return;
      if (e.key === 'Enter' && !showResult) {
        if (answer.trim()) {
          checkAnswer();
        }
      } else if (e.key === 'Enter' && showResult) {
        handleNext();
      } else if (e.key === 'Escape') {
        returnToMenu();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [answer, showResult, processedExercises.length, checkAnswer, handleNext, returnToMenu]);

  // Early return if no data
  if (!processedExercises.length) {
    return (
      <div className="completion-component__no-data">
        <p className="completion-component__no-data-text">
          {t('learning.noCompletionExercisesAvailable')}
        </p>
        <button onClick={handleReturnToMenu} className="completion-component__no-data-btn">
          {t('navigation.mainMenu')}
        </button>
      </div>
    );
  }

  const renderSentence = () => {
    if (!currentExercise?.sentence) return null;

    // Split sentence by blank marker (______)
    const parts = currentExercise.sentence.split('______');
    const elements: React.ReactElement[] = [];

    parts.forEach((part, index) => {
      // Add text part with structured content rendering
      if (part) {
        elements.push(
          <span key={`text-${index}`} className="completion-component__text">
            <ContentRenderer content={ContentAdapter.ensureStructured(part, 'quiz')} />
          </span>
        );
      }

      // Add input after each part except the last
      if (index < parts.length - 1) {
        const isCorrect =
          showResult &&
          answer.toLowerCase().trim() === currentExercise.correct?.toLowerCase().trim();
        const isIncorrect = showResult && answer && !isCorrect;

        let inputClass = 'completion-component__input';
        if (showResult) {
          if (isCorrect) {
            inputClass += ' completion-component__input--correct';
          } else if (isIncorrect) {
            inputClass += ' completion-component__input--incorrect';
          } else {
            inputClass += ' completion-component__input--disabled';
          }
        } else {
          inputClass += ' completion-component__input--neutral';
        }

        // Generate hint with first letter
        const firstLetter = currentExercise.correct?.charAt(0) || '';
        const placeholderHint = firstLetter ? `${firstLetter}...` : '...';

        elements.push(
          <EditableInput
            key={`input-${index}`}
            ref={inputRef}
            value={answer}
            onChange={value => setAnswer(value.toLowerCase())}
            disabled={showResult}
            placeholder={placeholderHint}
            className={`editable-input ${inputClass.replace('completion-component__input', 'editable-input')}`}
            style={
              {
                '--dynamic-width': `${Math.max(120, (answer?.length || 3) * 12 + 60)}px`,
                textTransform: 'lowercase',
              } as React.CSSProperties
            }
            autoFocus={!showResult}
          />
        );
      }
    });

    return <>{elements}</>;
  };

  const hasAnswer = answer.trim().length > 0;

  return (
    <div className="completion-component__container">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={module.name}
        currentIndex={currentIndex}
        totalItems={processedExercises.length}
        mode="completion"
        helpText={showResult ? t('learning.pressEnterNext') : t('learning.fillBlank')}
      />

      {/* Exercise */}
      <div className="completion-component__exercise-card">
        <h3 className="completion-component__instruction">{t('learning.completeSentence')}</h3>

        {currentExercise?.tip && (
          <div className="completion-component__tip">
            <p className="completion-component__tip-text">
              💡 <strong>{t('learning.tip')}</strong> {currentExercise.tip}
            </p>
          </div>
        )}

        <div className="completion-component__sentence-container">
          <div className="completion-component__sentence">{renderSentence()}</div>
        </div>

        {/* Result and Explanation - Compact unified section */}
        <div
          className={`completion-component__result-container ${
            showResult
              ? 'completion-component__result-container--visible'
              : 'completion-component__result-container--hidden'
          }`}
        >
          <div className="completion-component__result">
            {/* Ultra-compact result feedback */}
            <div className="completion-component__feedback-row">
              {answer.toLowerCase().trim() === currentExercise?.correct?.toLowerCase().trim() ? (
                <Check className="completion-component__feedback-icon completion-component__feedback-icon--correct" />
              ) : (
                <X className="completion-component__feedback-icon completion-component__feedback-icon--incorrect" />
              )}
              <span className="completion-component__feedback">
                {answer.toLowerCase().trim() === currentExercise?.correct?.toLowerCase().trim()
                  ? t('common.correct')
                  : t('common.incorrect')}
              </span>

              {/* Correct answer flows naturally after incorrect */}
              {answer.toLowerCase().trim() !== currentExercise?.correct?.toLowerCase().trim() && (
                <span className="completion-component__correct-answer">
                  - {t('learning.answer')} <strong>{currentExercise?.correct}</strong>
                </span>
              )}
            </div>

            {/* Compact explanation */}
            {showResult &&
              answer.toLowerCase().trim() !== currentExercise?.correct?.toLowerCase().trim() &&
              isTenseError(answer, currentExercise?.correct || '') && (
                <div className="completion-component__tense-hint">
                  <p className="completion-component__tense-hint-text">
                    {t('learning.tenseHint')}
                  </p>
                </div>
              )}
            {showResult &&
              answer.toLowerCase().trim() !== currentExercise?.correct?.toLowerCase().trim() &&
              !isTenseError(answer, currentExercise?.correct || '') &&
              isParticleError(answer, currentExercise?.correct || '') && (
                <div className="completion-component__tense-hint">
                  <p className="completion-component__tense-hint-text">
                    {t('learning.particleHint')}
                  </p>
                </div>
              )}
            {currentExercise?.explanation && (
              <div className="completion-component__explanation">
                <div className="completion-component__explanation-text">
                  <span className="completion-component__explanation-label">
                    {t('learning.explanation')}
                  </span>{' '}
                  <ContentRenderer
                    content={ContentAdapter.ensureStructured(
                      currentExercise.explanation,
                      'explanation'
                    )}
                  />
                </div>
              </div>
            )}
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
          <button
            onClick={checkAnswer}
            disabled={!hasAnswer}
            className="game-controls__primary-btn game-controls__primary-btn--purple"
          >
            <Check className="game-controls__primary-icon" />
            <span>{t('learning.checkAnswer')}</span>
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="game-controls__primary-btn game-controls__primary-btn--green"
          >
            <span>
              {currentIndex === processedExercises.length - 1
                ? t('learning.finishExercise')
                : t('learning.nextExercise')}
            </span>
            <ArrowRight className="game-controls__primary-icon" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CompletionComponent;
