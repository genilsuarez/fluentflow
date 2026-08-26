import { useAppStore } from '../../stores/appStore';
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useProgressStore } from '../../stores/progressStore';
import { useTranslation } from '../../utils/i18n';
import { useLearningCleanup } from '../../hooks/useLearningCleanup';
import { useSwipe } from '../../hooks/useSwipe';
import { createLearnFlowId } from '../../services/learnFlowIntegration';
import { ContentAdapter } from '../../utils/contentAdapter';
import ContentRenderer from '../ui/ContentRenderer';
import LearningProgressHeader from '../ui/LearningProgressHeader';

import '../../styles/components/reading-component.css';
import type { ReadingData, LearningModule } from '../../types';
import { GameControlsExitButton } from '../ui/GameControlsExitButton';
import { GameControlsResetButton } from '../ui/GameControlsResetButton';
import { GameControlsNavButton } from '../ui/GameControlsNavButton';

interface ReadingComponentProps {
  module: LearningModule;
}

const ReadingComponent: React.FC<ReadingComponentProps> = ({ module }) => {
  const triggerRestart = useAppStore(state => state.triggerRestart);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1); // Start at -1 for objectives page
  const [startTime] = useState(Date.now());
  const [runId] = useState(() => createLearnFlowId('run'));
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [vocabularyExpanded, setVocabularyExpanded] = useState(false);
  const [grammarExpanded, setGrammarExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialHeightRef = useRef<number>(0);
  const vocabularyRef = useRef<HTMLDivElement>(null);
  const grammarRef = useRef<HTMLDivElement>(null);

  const updateUserScore = useUserStore(state => state.updateUserScore);
  const { language } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const addProgressEntry = useProgressStore(state => state.addProgressEntry);
  const { t } = useTranslation(language);
  useLearningCleanup();

  // Capture initial height from objectives page to prevent layout jumps (desktop only)
  useLayoutEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) return;
    if (currentSectionIndex === -1 && containerRef.current && initialHeightRef.current === 0) {
      const height = containerRef.current.getBoundingClientRect().height;
      if (height > 0) {
        initialHeightRef.current = height;
        containerRef.current.style.minHeight = `${height}px`;
      }
    }
  });

  const handleReturnToMenu = () => returnToMenu();

  // Get reading data from module
  const readingData = useMemo(() => {
    if (!module?.data || !Array.isArray(module.data) || module.data.length === 0) {
      return null;
    }
    return module.data[0] as ReadingData;
  }, [module?.data]);

  const readingSections = readingData?.sections || [];
  const currentSection = readingSections[currentSectionIndex];
  const isObjectivesPage = currentSectionIndex === -1;
  const isSummaryPage = currentSectionIndex === readingSections.length;
  const hasSummaryContent =
    (readingData?.keyVocabulary?.length ?? 0) > 0 || (readingData?.grammarPoints?.length ?? 0) > 0;

  // Parsed content is memoized by source text so re-renders that don't touch
  // the reading data (e.g. store updates unrelated to this module) don't
  // re-run ContentAdapter's regex parsing for every paragraph/term again.
  const parsedSectionTitle = useMemo(
    () => ContentAdapter.ensureStructured(currentSection?.title || '', 'reading'),
    [currentSection?.title]
  );

  const parsedContentParagraphs = useMemo(() => {
    const text = currentSection?.content;
    if (!text || currentSection?.type === 'examples') return [];
    return text.split('\n\n').map(paragraph => {
      const lines = paragraph.split('\n');
      const nonEmptyLines = lines.filter(l => l.trim());
      const isBulletList =
        nonEmptyLines.length > 0 && nonEmptyLines.every(l => /^[•·]\s/.test(l.trim()));
      if (isBulletList) {
        return {
          type: 'bullet' as const,
          items: lines
            .filter(l => l.trim())
            .map(line =>
              ContentAdapter.ensureStructured(line.trim().replace(/^[•·]\s*/, ''), 'reading')
            ),
        };
      }
      return {
        type: 'paragraph' as const,
        lines: lines.map(line => ContentAdapter.ensureStructured(line, 'reading')),
      };
    });
  }, [currentSection?.content, currentSection?.type]);

  const parsedTooltips = useMemo(() => {
    const tooltips = currentSection?.interactive?.tooltips;
    if (!tooltips?.length) return [];
    return tooltips.map(tooltip => ({
      term: ContentAdapter.ensureStructured(tooltip.term, 'reading'),
      definition: ContentAdapter.ensureStructured(tooltip.definition, 'reading'),
    }));
  }, [currentSection?.interactive?.tooltips]);

  const parsedExpandables = useMemo(() => {
    const expandable = currentSection?.interactive?.expandable;
    if (!expandable?.length) return [];
    return expandable.map(item => ({
      title: ContentAdapter.ensureStructured(item.title, 'reading'),
      content: ContentAdapter.ensureStructured(item.content, 'reading'),
    }));
  }, [currentSection?.interactive?.expandable]);

  const parsedGrammarPoints = useMemo(() => {
    const points = readingData?.grammarPoints;
    if (!points?.length) return [];
    return points.map(point => ({
      rule: ContentAdapter.ensureStructured(point.rule, 'reading'),
      explanation: ContentAdapter.ensureStructured(point.explanation, 'explanation'),
    }));
  }, [readingData?.grammarPoints]);

  const parsedVocabulary = useMemo(() => {
    const vocabulary = readingData?.keyVocabulary;
    if (!vocabulary?.length) return [];
    return vocabulary.map(term => ({
      term: ContentAdapter.ensureStructured(term.term, 'reading'),
      definition: ContentAdapter.ensureStructured(term.definition, 'reading'),
      example: ContentAdapter.ensureStructured(term.example, 'reading'),
    }));
  }, [readingData?.keyVocabulary]);

  const handleNext = useCallback(() => {
    const maxIndex = hasSummaryContent ? readingSections.length : readingSections.length - 1;

    if (currentSectionIndex < maxIndex) {
      // Reset scroll instantly before changing section
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      setCurrentSectionIndex(currentSectionIndex + 1);
      // Reset interactive states when changing sections
      setExpandedItems(new Set());
    } else {
      // End of reading
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Update user score first (this triggers completeModule in userStore)
      updateUserScore(module.id, 100, timeSpent);

      // Register progress (reading is completion-based, so 100% for finishing)
      addProgressEntry({
        runId,
        score: 100,
        totalQuestions: readingSections.length,
        correctAnswers: readingSections.length,
        moduleId: module.id,
        learningMode: 'reading',
        timeSpent: timeSpent,
      });

      returnToMenu({ autoScrollToNext: true });
    }
  }, [
    currentSectionIndex,
    readingSections.length,
    hasSummaryContent,
    startTime,
    runId,
    addProgressEntry,
    module.id,
    updateUserScore,
    returnToMenu,
  ]);

  const handlePrev = useCallback(() => {
    if (currentSectionIndex > -1) {
      // Reset scroll instantly before changing section
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      setCurrentSectionIndex(currentSectionIndex - 1);
      // Reset interactive states when changing sections
      setExpandedItems(new Set());
    }
  }, [currentSectionIndex]);

  const toggleExpandable = useCallback((index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Scroll expanded summary section so its trigger is at the top of the visible area
  useEffect(() => {
    if (!vocabularyExpanded && !grammarExpanded) return;
    const ref = vocabularyExpanded ? vocabularyRef : grammarRef;
    const trigger = ref?.current?.querySelector('button');
    if (!trigger) return;
    const timer = setTimeout(() => {
      trigger.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(timer);
  }, [vocabularyExpanded, grammarExpanded]);

  // Keyboard navigation
  useEffect(() => {
    if (readingSections.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'Enter':
          e.preventDefault();
          handleNext();
          break;
        case 'Escape':
          returnToMenu();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSectionIndex, readingSections.length, handleNext, handlePrev, returnToMenu]);

  // Swipe navigation (mobile)
  useSwipe({ onNext: handleNext, onPrev: handlePrev }, containerRef);

  // Early return if no data
  if (!readingData || !readingSections.length) {
    return (
      <div className="reading-component__no-data">
        <p className="reading-component__no-data-text">{t('learning.noReadingContentAvailable')}</p>
        <button onClick={handleReturnToMenu} className="reading-component__no-data-btn">
          {t('navigation.mainMenu')}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="reading-component__container">
      {/* Unified progress header */}
      <LearningProgressHeader
        title={readingData.title}
        currentIndex={currentSectionIndex + 1}
        totalItems={readingSections.length + 1 + (hasSummaryContent ? 1 : 0)}
        mode="reading"
      />

      {/* Reading content */}
      <div ref={contentRef} className="reading-component__content">
        {/* Learning Objectives Page - Dedicated first page */}
        {isObjectivesPage ? (
          <div className="reading-component__objectives-page">
            {/* Estimated reading time badge */}
            {readingData.estimatedReadingTime && readingSections.length > 0 && (
              <div className="reading-component__objectives-page-meta">
                <span className="reading-component__time-badge">
                  <svg
                    className="reading-component__time-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {t('reading.component.estimatedTime', undefined, {
                    time: String(readingData.estimatedReadingTime),
                  })}
                </span>
              </div>
            )}

            {/* Learning Objectives - Centered and prominent */}
            {readingData.learningObjectives?.length > 0 && (
              <div className="reading-component__objectives-centered">
                <h3 className="reading-component__objectives-centered-title">
                  {t('reading.component.objectives')}
                </h3>
                <ul className="reading-component__objectives-centered-list">
                  {readingData.learningObjectives.map((objective, index) => (
                    <li key={index} className="reading-component__objectives-centered-item">
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : isSummaryPage ? (
          <div className="reading-component__summary-page">
            <h3 className="reading-component__summary-title">{t('reading.component.summary')}</h3>

            {/* Grammar Points Section - Enhanced Collapsible */}
            {readingData.grammarPoints && readingData.grammarPoints.length > 0 && (
              <div ref={grammarRef} className="reading-component__grammar-points">
                <button
                  className="reading-component__summary-section-trigger"
                  onClick={() => {
                    const next = !grammarExpanded;
                    setGrammarExpanded(next);
                    if (next) setVocabularyExpanded(false);
                  }}
                  aria-expanded={grammarExpanded}
                  aria-controls="grammar-content"
                  aria-label={t('reading.accessibility.grammarSectionLabel', undefined, {
                    action: grammarExpanded
                      ? t('reading.accessibility.collapseSection')
                      : t('reading.accessibility.expandSection'),
                    count: readingData.grammarPoints.length,
                    unit:
                      readingData.grammarPoints.length === 1
                        ? t('reading.accessibility.ruleSingular')
                        : t('reading.accessibility.rulePlural'),
                  })}
                >
                  <span className="reading-component__summary-section-title">
                    {t('reading.component.grammarPoints')}
                    <span className="reading-component__summary-section-count">
                      {readingData.grammarPoints.length}
                    </span>
                  </span>
                  <ChevronDown className="reading-component__summary-section-icon" />
                </button>
                {grammarExpanded && readingData.grammarPoints && (
                  <div
                    id="grammar-content"
                    role="region"
                    aria-label={t('reading.component.grammarPoints')}
                  >
                    {readingData.grammarPoints.map((point, index) => (
                      <div key={index} className="reading-component__grammar-point">
                        <div className="reading-component__grammar-point-header">
                          <span
                            className="reading-component__grammar-point-number"
                            aria-label={`Grammar point ${index + 1} of ${readingData.grammarPoints?.length ?? 0}`}
                          >
                            {index + 1}
                          </span>
                          <div className="reading-component__grammar-rule">
                            <ContentRenderer content={parsedGrammarPoints[index].rule} />
                          </div>
                        </div>
                        <div className="reading-component__grammar-explanation">
                          <ContentRenderer content={parsedGrammarPoints[index].explanation} />
                        </div>
                        {point.examples && point.examples.length === 1 ? (
                          <div className="reading-component__grammar-single-line">
                            <span className="reading-component__grammar-inline-label">Ej:</span>
                            <span className="reading-component__grammar-example-inline">
                              {point.examples[0]}
                            </span>
                          </div>
                        ) : point.examples && point.examples.length > 1 ? (
                          <div className="reading-component__grammar-examples">
                            <div className="reading-component__grammar-examples-title">
                              {t('reading.component.examples')}
                            </div>
                            <ul className="reading-component__grammar-examples-list">
                              {point.examples.map((example, exIndex) => (
                                <li
                                  key={exIndex}
                                  className="reading-component__grammar-example-item"
                                >
                                  {example}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {point.commonMistakes && point.commonMistakes.length === 1 ? (
                          <div className="reading-component__grammar-single-line reading-component__grammar-single-line--warn">
                            <span className="reading-component__grammar-inline-label reading-component__grammar-inline-label--warn">
                              ✗
                            </span>
                            <span className="reading-component__grammar-mistake-inline">
                              {point.commonMistakes[0]}
                            </span>
                          </div>
                        ) : point.commonMistakes && point.commonMistakes.length > 1 ? (
                          <div className="reading-component__grammar-mistakes">
                            <div className="reading-component__grammar-mistakes-title">
                              {t('reading.component.commonMistakes')}
                            </div>
                            <ul className="reading-component__grammar-mistakes-list">
                              {point.commonMistakes.map((mistake, mIndex) => (
                                <li
                                  key={mIndex}
                                  className="reading-component__grammar-mistake-item"
                                >
                                  {mistake}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Key Vocabulary Section - Enhanced Collapsible */}
            {readingData.keyVocabulary?.length > 0 && (
              <div ref={vocabularyRef} className="reading-component__vocabulary">
                <button
                  className="reading-component__summary-section-trigger"
                  onClick={() => {
                    const next = !vocabularyExpanded;
                    setVocabularyExpanded(next);
                    if (next) setGrammarExpanded(false);
                  }}
                  aria-expanded={vocabularyExpanded}
                  aria-controls="vocabulary-content"
                  aria-label={t('reading.accessibility.vocabularySectionLabel', undefined, {
                    action: vocabularyExpanded
                      ? t('reading.accessibility.collapseSection')
                      : t('reading.accessibility.expandSection'),
                    count: readingData.keyVocabulary.length,
                    unit:
                      readingData.keyVocabulary.length === 1
                        ? t('reading.accessibility.termSingular')
                        : t('reading.accessibility.termPlural'),
                  })}
                >
                  <span className="reading-component__summary-section-title">
                    {t('reading.component.keyVocabulary')}
                    <span className="reading-component__summary-section-count">
                      {readingData.keyVocabulary.length}
                    </span>
                  </span>
                  <ChevronDown className="reading-component__summary-section-icon" />
                </button>
                {vocabularyExpanded && (
                  <div
                    id="vocabulary-content"
                    className="reading-component__vocabulary-grid"
                    role="region"
                    aria-label={t('reading.component.keyVocabulary')}
                  >
                    {readingData.keyVocabulary.map((term, index) => (
                      <div key={index} className="reading-component__vocabulary-card">
                        <div className="reading-component__vocabulary-card-header">
                          <div className="reading-component__vocabulary-term">
                            <ContentRenderer content={parsedVocabulary[index].term} />
                          </div>
                          {term.pronunciation && (
                            <div className="reading-component__vocabulary-pronunciation">
                              {term.pronunciation}
                            </div>
                          )}
                        </div>
                        <div className="reading-component__vocabulary-content">
                          <div className="reading-component__vocabulary-definition-block">
                            <div className="reading-component__vocabulary-label">
                              {t('reading.component.definition')}
                            </div>
                            <div className="reading-component__vocabulary-definition">
                              <ContentRenderer content={parsedVocabulary[index].definition} />
                            </div>
                          </div>
                          <div className="reading-component__vocabulary-example-block">
                            <div className="reading-component__vocabulary-label">
                              {t('reading.component.example')}
                            </div>
                            <div className="reading-component__vocabulary-example">
                              <ContentRenderer content={parsedVocabulary[index].example} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Regular content section */}
            <h3 className="reading-component__section-title">
              <ContentRenderer content={parsedSectionTitle} />
            </h3>

            <div className="reading-component__section-content">
              {currentSection?.type === 'examples' ? (
                <div className="reading-component__examples-grid">
                  {currentSection.content.split('\n\n').map((example, index) => {
                    // Parse example format: "Example N: <Quote> (note)"
                    // Supports angle brackets, single quotes, and double quotes
                    const angleBracketMatch = example.match(/^Example (\d+):\s*<([^>]+)>\s*(.*)$/s);
                    const dashAngleMatch = example.match(
                      /^Example (\d+):\s*(.+?)\s*-\s*<([\s\S]+?)>\s*(.*)$/
                    );
                    const dashQuoteMatch = example.match(
                      /^Example (\d+):\s*(.+?)\s*-\s*(['"])(.+?)\3\s*(.*)$/
                    );

                    // Check if quote contains dialogue lines (A: ... B: ...)
                    const isDialogue = (text: string) => /^[A-Z]:\s/m.test(text);

                    const renderQuote = (quote: string) => {
                      if (isDialogue(quote)) {
                        return (
                          <div className="reading-component__dialogue">
                            {quote
                              .split('\n')
                              .filter(l => l.trim())
                              .map((line, i) => {
                                const speakerMatch = line.match(/^([A-Z]):\s(.+)$/);
                                if (speakerMatch) {
                                  const [, speaker, text] = speakerMatch;
                                  return (
                                    <div key={i} className="reading-component__dialogue-line">
                                      <span className="reading-component__dialogue-speaker">
                                        {speaker}:
                                      </span>
                                      <span className="reading-component__dialogue-text">
                                        {text}
                                      </span>
                                    </div>
                                  );
                                }
                                return <div key={i}>{line}</div>;
                              })}
                          </div>
                        );
                      }
                      return <>&ldquo;{quote}&rdquo;</>;
                    };

                    if (dashAngleMatch) {
                      const [, number, title, quote, note] = dashAngleMatch;
                      return (
                        <div key={index} className="reading-component__example-card">
                          <div className="reading-component__example-card-header">
                            <span className="reading-component__example-number">{number}</span>
                            <span className="reading-component__example-title">{title}</span>
                          </div>
                          <div className="reading-component__example-quote">
                            {renderQuote(quote)}
                            {note?.trim() && (
                              <span className="reading-component__example-note">
                                <ContentRenderer
                                  content={ContentAdapter.ensureStructured(note.trim(), 'reading')}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (angleBracketMatch) {
                      const [, number, quote, note] = angleBracketMatch;
                      return (
                        <div key={index} className="reading-component__example-card">
                          <div className="reading-component__example-quote">
                            <span className="reading-component__example-number">{number}</span>
                            {renderQuote(quote)}
                            {note?.trim() && (
                              <span className="reading-component__example-note">
                                <ContentRenderer
                                  content={ContentAdapter.ensureStructured(note.trim(), 'reading')}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (dashQuoteMatch) {
                      const [, number, title, , quote, note] = dashQuoteMatch;
                      return (
                        <div key={index} className="reading-component__example-card">
                          <div className="reading-component__example-card-header">
                            <span className="reading-component__example-number">{number}</span>
                            <span className="reading-component__example-title">{title}</span>
                          </div>
                          <div className="reading-component__example-quote">
                            {renderQuote(quote)}
                            {note?.trim() && (
                              <span className="reading-component__example-note">
                                <ContentRenderer
                                  content={ContentAdapter.ensureStructured(note.trim(), 'reading')}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Fallback for non-matching format
                    return example.trim() ? (
                      <div key={index} className="reading-component__example-card">
                        <div className="reading-component__example-content">
                          <ContentRenderer
                            content={ContentAdapter.ensureStructured(example, 'reading')}
                          />
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : currentSection?.content ? (
                <>
                  {parsedContentParagraphs.map((paragraph, idx) =>
                    paragraph.type === 'bullet' ? (
                      <ul key={idx} className="reading-component__bullet-list">
                        {paragraph.items.map((item, lineIdx) => (
                          <li key={lineIdx} className="reading-component__bullet-item">
                            <ContentRenderer content={item} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p key={idx}>
                        {paragraph.lines.map((lineContent, lineIdx, arr) => (
                          <React.Fragment key={lineIdx}>
                            <ContentRenderer content={lineContent} />
                            {lineIdx < arr.length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </p>
                    )
                  )}
                </>
              ) : (
                <p>{t('common.loading')}</p>
              )}
            </div>

            {/* Interactive Content - Tooltips (skip if section already has inline definitions) */}
            {currentSection?.interactive?.tooltips &&
              currentSection.interactive.tooltips.length > 0 &&
              !/[•·]\s*<[^>]+>\s*[–—-]/.test(currentSection.content || '') && (
                <div className="reading-component__tooltips">
                  <h4 className="reading-component__tooltips-title">
                    {currentSection.interactive.tooltips.length === 1
                      ? t('reading.component.keyTerm')
                      : t('reading.component.keyTerms')}
                  </h4>
                  <div className="reading-component__tooltips-grid">
                    {currentSection.interactive.tooltips.map((_tooltip, index) => (
                      <div key={index} className="reading-component__tooltip-card">
                        <span className="reading-component__tooltip-term">
                          <ContentRenderer content={parsedTooltips[index].term} />
                        </span>
                        <span className="reading-component__tooltip-definition">
                          <ContentRenderer content={parsedTooltips[index].definition} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Interactive Content - Expandable Sections */}
            {currentSection?.interactive?.expandable &&
              currentSection.interactive.expandable.length > 0 && (
                <div className="reading-component__expandables">
                  {currentSection.interactive.expandable.map((_expandable, index) => (
                    <div key={index} className="reading-component__expandable">
                      <button
                        className="reading-component__expandable-trigger"
                        onClick={() => toggleExpandable(index)}
                        aria-expanded={expandedItems.has(index)}
                      >
                        <span className="reading-component__expandable-title">
                          <ContentRenderer content={parsedExpandables[index].title} />
                        </span>
                        {expandedItems.has(index) ? (
                          <ChevronUp className="reading-component__expandable-icon" />
                        ) : (
                          <ChevronDown className="reading-component__expandable-icon" />
                        )}
                      </button>
                      {expandedItems.has(index) && (
                        <div className="reading-component__expandable-content">
                          <ContentRenderer content={parsedExpandables[index].content} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            {/* Interactive Content - Highlights */}
            {currentSection?.interactive?.highlights &&
              currentSection.interactive.highlights.length > 0 && (
                <div className="reading-component__highlights">
                  <h4 className="reading-component__highlights-title">
                    {t('reading.component.keyTerm')}
                  </h4>
                  <div className="reading-component__highlights-list">
                    {currentSection.interactive.highlights.map((highlight, index) => (
                      <span key={index} className="reading-component__highlight-item">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </div>

      {/* Unified Control Bar */}
      <div className="game-controls">
        {/* Home Navigation */}
        <GameControlsExitButton
          onClick={handleReturnToMenu}
          title={t('learning.returnToMainMenu')}
        />
        <GameControlsResetButton onClick={triggerRestart} title={t('common.reset')} />

        <GameControlsNavButton
          direction="prev"
          onClick={handlePrev}
          disabled={currentSectionIndex === -1}
          title={t('reading.component.previousSection')}
        />

        <button onClick={handleNext} className="game-controls__primary-btn">
          <span>
            {isObjectivesPage
              ? t('reading.component.startReading')
              : isSummaryPage ||
                  (!hasSummaryContent && currentSectionIndex === readingSections.length - 1)
                ? t('reading.component.completeReading')
                : t('reading.component.nextSection')}
          </span>
          <ChevronRight className="game-controls__primary-icon" />
        </button>
      </div>
    </div>
  );
};

export default ReadingComponent;
