import React from 'react';
import { diffAnswerSegments } from '../../utils/answerUtils';

interface AnswerReviewDisplayProps {
  answer: string;
  correctAnswers: string[];
  className?: string;
  variant?: 'editable' | 'quiz';
  center?: boolean;
  inline?: boolean;
  style?: React.CSSProperties;
}

export const AnswerReviewDisplay: React.FC<AnswerReviewDisplayProps> = ({
  answer,
  correctAnswers,
  className = '',
  variant = 'editable',
  center = false,
  inline = false,
  style,
}) => {
  const segments = diffAnswerSegments(answer, correctAnswers);

  if (variant === 'quiz') {
    return (
      <div
        className={`quiz-component__text-input-review${center ? ' quiz-component__text-input--center' : ''} ${className}`.trim()}
        aria-readonly="true"
        style={style}
      >
        {segments.map((segment, index) => (
          <span
            key={`${index}-${segment.text}`}
            className={
              segment.isError ? 'quiz-component__text-input-review__segment--error' : undefined
            }
          >
            {segment.text}
          </span>
        ))}
      </div>
    );
  }

  const layoutClass = inline ? 'editable-input--inline' : 'editable-input--fullwidth';

  return (
    <div
      className={`editable-input ${layoutClass} editable-input--incorrect editable-input--review ${className}`.trim()}
      aria-readonly="true"
      style={style}
    >
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text}`}
          className={segment.isError ? 'editable-input__segment--error' : undefined}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
};
