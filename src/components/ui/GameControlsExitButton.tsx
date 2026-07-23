import { LayoutGrid } from 'lucide-react';

interface GameControlsExitButtonProps {
  onClick: () => void;
  title: string;
}

/** Exit current exercise → module menu (not portal home). */
export function GameControlsExitButton({ onClick, title }: GameControlsExitButtonProps) {
  return (
    <button type="button" onClick={onClick} className="game-controls__home-btn" title={title}>
      <LayoutGrid className="game-controls__action-icon" aria-hidden="true" />
    </button>
  );
}
