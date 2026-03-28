import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import '../../styles/components/confirm-modal.css';
import '../../styles/components/modal-buttons.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'danger' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="confirm-modal" onClick={onClose} role="presentation">
      <div
        className="confirm-modal__container"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <div className="confirm-modal__header">
          <div className="confirm-modal__title-section">
            <AlertTriangle className={`confirm-modal__icon confirm-modal__icon--${variant}`} />
            <h2 id="confirm-modal-title" className="confirm-modal__title">
              {title}
            </h2>
          </div>
          <button onClick={onClose} className="modal__close-btn" aria-label="Close">
            <X className="modal__close-icon" />
          </button>
        </div>
        <div className="confirm-modal__body">
          <p id="confirm-modal-message" className="confirm-modal__message">
            {message}
          </p>
        </div>
        <div className="confirm-modal__actions">
          <button onClick={onClose} className="confirm-modal__btn confirm-modal__btn--cancel">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`confirm-modal__btn confirm-modal__btn--${variant}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
