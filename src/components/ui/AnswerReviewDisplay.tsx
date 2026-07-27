import React from 'react';
import { diffAnswerSegments } from '../../utils/answerUtils';

interface AnswerReviewDisplayProps {
  answer: string;
  correctAnswers: string[];
  className?: string;
}

export const AnswerReviewDisplay: React.FC<AnswerReviewDisplayProps> = ({
  answer,
  correctAnswers,
  className = '',
}) => {
  const segments = diffAnswerSegments(answer, correctAnswers);

  return (
    <div
      className={`editable-input editable-input--fullwidth editable-input--incorrect editable-input--review ${className}`.trim()}
      aria-readonly="true"
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
