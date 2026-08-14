import React from 'react';
import { X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { appHref, isLocalPlatformHost, type PlatformApp } from '../../utils/platformUrls';
import { aboutText, getAboutContent } from '../../data/lpAboutContent';
import '../../styles/components/compact-about.css';

interface CompactAboutProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompactAbout: React.FC<CompactAboutProps> = ({ isOpen, onClose }) => {
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  const isLocal = isLocalPlatformHost();

  const preserveTheme = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isLocal) return;
    const url = new URL(event.currentTarget.href);
    url.searchParams.set(
      'theme',
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );
    event.currentTarget.href = url.toString();
  };

  const handleClose = () => {
    onClose();
  };

  const aboutContent = getAboutContent();
  const aboutLang: 'es' | 'en' = language === 'es' ? 'es' : 'en';

  useEscapeKey(isOpen, handleClose);

  if (!isOpen) return null;

  return (
    <div
      className="about-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        aria-describedby="about-description"
      >
        <header className="about-header">
          <div className="about-identity" aria-hidden="true">
            L
          </div>
          <div className="about-header__text">
            <p className="about-eyebrow">{aboutContent.eyebrow}</p>
            <h2 id="about-title">{aboutText(aboutContent.title, aboutLang)}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="about-close"
            aria-label={t('common.close')}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="about-body">
          <p id="about-description" className="about-description">
            {aboutText(aboutContent.description, aboutLang)}
          </p>

          <nav className="about-modules" aria-label={t('about.learnFlowLinks')}>
            {aboutContent.modules.map(mod => (
              <a key={mod.id} href={appHref(mod.id as PlatformApp)} onClick={preserveTheme}>
                <span
                  className={`about-module__mark about-module__mark--${mod.markClass}`}
                  aria-hidden="true"
                >
                  {mod.mark}
                </span>
                <span className="about-module__text">
                  <strong>{mod.name}</strong>
                  <span>{aboutText(mod.subtitle, aboutLang)}</span>
                </span>
              </a>
            ))}
          </nav>
        </div>

        <footer className="about-footer">
          <div className="about-author">
            <div className="about-author__avatar" aria-hidden="true">
              {aboutContent.author.initials}
            </div>
            <div className="about-author__info">
              <strong>{aboutContent.author.name}</strong>
              <span>{aboutText(aboutContent.author.bio, aboutLang)}</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};
