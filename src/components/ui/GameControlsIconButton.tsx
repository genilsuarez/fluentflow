import type { ReactNode } from 'react';

interface GameControlsIconButtonProps {
  onClick: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  /** When true, stays visible on mobile (e.g. info after check). Default: desktop-only. */
  showOnMobile?: boolean;
}

/** Secondary circular icon action — hidden on mobile unless `showOnMobile`. */
export function GameControlsIconButton({
  onClick,
  title,
  children,
  disabled = false,
  showOnMobile = false,
}: GameControlsIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`game-controls__icon-btn${showOnMobile ? ' game-controls__info-btn' : ' game-controls__desktop-only'}`}
      title={title}
    >
      {children}
    </button>
  );
}
