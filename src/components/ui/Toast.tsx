import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { type ToastData } from '../../stores/toastStore';
import '../../styles/components/toast-card.css';

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  }, [onClose, toast.id]);

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration || 4000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [toast.duration, handleClose]);

  const getIcon = () => {
    const iconProps = { className: 'toast-card__icon-svg', 'aria-hidden': true };

    switch (toast.type) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <XCircle {...iconProps} />;
      case 'warning':
        return <AlertCircle {...iconProps} />;
      case 'info':
        return <Info {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  // BEM classes
  const baseClass = 'toast-card';
  const modifierClass = `${baseClass}--${toast.type}`;
  const stateClass = isLeaving
    ? `${baseClass}--exiting`
    : isVisible
      ? `${baseClass}--visible`
      : `${baseClass}--entering`;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`${baseClass} ${modifierClass} ${stateClass}`}
    >
      <div className={`${baseClass}__container`}>
        <div className={`${baseClass}__content`}>
          <div className={`${baseClass}__icon`}>{getIcon()}</div>

          <div className={`${baseClass}__text`}>
            <div className={`${baseClass}__title`}>{toast.title}</div>
            {toast.message && <div className={`${baseClass}__message`}>{toast.message}</div>}
          </div>

          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className={`${baseClass}__action`}
              aria-label={toast.action.label}
            >
              {toast.action.label}
            </button>
          )}

          <button
            onClick={handleClose}
            className={`${baseClass}__close`}
            aria-label="Close notification"
          >
            <X className={`${baseClass}__close-icon`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
