import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GameControlsNavButtonProps {
  direction: 'prev' | 'next';
  onClick: () => void;
  title: string;
  disabled?: boolean;
}

/** Circular prev/next control in the game-controls bar. */
export function GameControlsNavButton({
  direction,
  onClick,
  title,
  disabled = false,
}: GameControlsNavButtonProps) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="game-controls__nav-btn"
      title={title}
    >
      <Icon className="game-controls__nav-icon" aria-hidden="true" />
    </button>
  );
}
