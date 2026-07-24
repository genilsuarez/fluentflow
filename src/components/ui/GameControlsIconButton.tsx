import type { ReactNode } from 'react';

interface GameControlsIconButtonProps {
  onClick: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
}

/** Secondary circular icon action — hidden on mobile via `.game-controls__desktop-only`. */
export function GameControlsIconButton({
  onClick,
  title,
  children,
  disabled = false,
}: GameControlsIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="game-controls__icon-btn game-controls__desktop-only"
      title={title}
    >
      {children}
    </button>
  );
}
