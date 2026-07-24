import { RotateCcw } from 'lucide-react';

interface GameControlsResetButtonProps {
  onClick: () => void;
  title: string;
}

/** Restart current exercise — hidden on mobile via `.game-controls__reset-btn` in CSS. */
export function GameControlsResetButton({ onClick, title }: GameControlsResetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="game-controls__home-btn game-controls__reset-btn"
      title={title}
    >
      <RotateCcw className="game-controls__action-icon" aria-hidden="true" />
    </button>
  );
}
