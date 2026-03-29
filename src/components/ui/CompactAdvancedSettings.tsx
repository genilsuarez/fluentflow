import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings, Save, Gamepad2, Palette, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { validateGameSettings } from '../../utils/inputValidation';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { logError } from '../../utils/logger';
import {
  downloadLevels,
  retryFailedUrls,
  deleteAllCache,
  formatStorageSize,
  getTotalCacheSize,
} from '../../services/offlineManager';
import type { DownloadProgress } from '../../services/offlineManager';
import { DownloadManagerModal } from './DownloadManagerModal';
import '../../styles/components/compact-advanced-settings.css';
import '../../styles/components/modal-buttons.css';

interface CompactAdvancedSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompactAdvancedSettings: React.FC<CompactAdvancedSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    theme,
    language,
    level,
    developmentMode,
    randomizeItems,
    gameSettings,
    offlineEnabled,
    downloadedLevels,
    setTheme,
    setLanguage,
    setLevel,
    setDevelopmentMode,
    setRandomizeItems,
    setGameSetting,
    setOfflineEnabled,
    setDownloadedLevels,
    setLastDownloadDate,
  } = useSettingsStore();

  const { t } = useTranslation(language);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'games' | 'offline'>('general');

  // Offline state
  const cacheSupported = 'caches' in window;
  const allLevels = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [totalCacheSize, setTotalCacheSize] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle escape key to close modal (disabled when download manager is open)
  useEscapeKey(isOpen && !isModalOpen, onClose);

  // Local state for editing
  const [localTheme, setLocalTheme] = useState(theme);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [localLevel, setLocalLevel] = useState(level);
  const [localDevelopmentMode, setLocalDevelopmentMode] = useState(developmentMode);
  const [localRandomizeItems, setLocalRandomizeItems] = useState(randomizeItems);
  const [localGameSettings, setLocalGameSettings] = useState(gameSettings);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTheme(theme);
      setLocalLanguage(language);
      setLocalLevel(level);
      setLocalDevelopmentMode(developmentMode);
      setLocalRandomizeItems(randomizeItems);
      setLocalGameSettings(gameSettings);
      setHasChanges(false);
    } else {
      // Reset download manager modal state when main modal closes
      setIsModalOpen(false);
    }
  }, [isOpen, theme, language, level, developmentMode, randomizeItems, gameSettings]);

  // Check for changes
  useEffect(() => {
    const changed =
      localTheme !== theme ||
      localLanguage !== language ||
      localLevel !== level ||
      localDevelopmentMode !== developmentMode ||
      localRandomizeItems !== randomizeItems ||
      JSON.stringify(localGameSettings) !== JSON.stringify(gameSettings);
    setHasChanges(changed);
  }, [
    localTheme,
    localLanguage,
    localLevel,
    localDevelopmentMode,
    localRandomizeItems,
    localGameSettings,
    theme,
    language,
    level,
    developmentMode,
    randomizeItems,
    gameSettings,
  ]);

  // Sync selectedLevels with downloadedLevels when modal opens
  useEffect(() => {
    if (isOpen && offlineEnabled) {
      if (downloadedLevels.length > 0) {
        setSelectedLevels([...downloadedLevels]);
      } else if (selectedLevels.length === 0) {
        // First time enabling: pre-select current level
        const defaultLevel = level === 'all' ? 'a1' : level;
        setSelectedLevels([defaultLevel]);
      }
    }
  }, [isOpen, offlineEnabled, downloadedLevels, level]);

  // Load total cache size when modal opens and offline is enabled
  useEffect(() => {
    if (isOpen && offlineEnabled && cacheSupported) {
      getTotalCacheSize()
        .then(setTotalCacheSize)
        .catch(() => setTotalCacheSize(0));
    }
  }, [isOpen, offlineEnabled, cacheSupported, downloadedLevels]);

  const handleToggleOffline = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        // Deactivating: delete all cache and clean state
        await deleteAllCache();
        setDownloadedLevels([]);
        setLastDownloadDate(null);
        setOfflineEnabled(false);
        setTotalCacheSize(0);
        setSelectedLevels([]);
        setFailedUrls([]);
      } else {
        setOfflineEnabled(true);
        // selectedLevels will be set by the sync useEffect above
      }
    },
    [level, setOfflineEnabled, setDownloadedLevels, setLastDownloadDate]
  );

  const handleLevelCheckbox = useCallback((lvl: string, checked: boolean) => {
    setSelectedLevels(prev => (checked ? [...prev, lvl] : prev.filter(l => l !== lvl)));
  }, []);

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    // Validación: si no hay niveles seleccionados, mostrar mensaje
    if (selectedLevels.length === 0) {
      // Usar el sistema de toast para mostrar el mensaje
      return;
    }

    setIsDownloading(true);
    setFailedUrls([]);
    setDownloadProgress(null);

    try {
      // Clean approach: delete all cache and re-download only selected levels
      // This ensures consistency between selected levels and cached content
      await deleteAllCache();

      // Download selected levels with current category filters
      if (selectedLevels.length > 0) {
        const result = await downloadLevels(selectedLevels, progress => {
          setDownloadProgress(progress);
        });

        if (result.failed.length > 0) {
          setFailedUrls(result.failed);
        }
      }

      setDownloadedLevels(selectedLevels);
      setLastDownloadDate(new Date().toISOString());

      // Refresh cache size
      const size = await getTotalCacheSize();
      setTotalCacheSize(size);
    } catch (error) {
      logError('Download error', { error }, 'CompactAdvancedSettings');
    } finally {
      setIsDownloading(false);
    }
  }, [selectedLevels, isDownloading, downloadedLevels, setDownloadedLevels, setLastDownloadDate]);

  const handleRetryFailed = useCallback(async () => {
    if (failedUrls.length === 0 || isDownloading) return;
    setIsDownloading(true);

    try {
      // Only retry the specific URLs that failed, not everything
      const result = await retryFailedUrls(failedUrls, progress => {
        setDownloadProgress(progress);
      });

      setFailedUrls(result.failed);

      if (result.failed.length === 0) {
        setDownloadedLevels(selectedLevels);
        setLastDownloadDate(new Date().toISOString());
      }

      const size = await getTotalCacheSize();
      setTotalCacheSize(size);
    } catch {
      // Error handled via progress
    } finally {
      setIsDownloading(false);
    }
  }, [failedUrls, isDownloading, selectedLevels, setDownloadedLevels, setLastDownloadDate]);

  const handleSave = () => {
    if (!hasChanges) return;

    // Validate all settings before saving
    const validatedSettings = validateGameSettings(localGameSettings);

    // Apply all changes
    setTheme(localTheme);
    setLanguage(localLanguage);
    setLevel(localLevel);
    setDevelopmentMode(localDevelopmentMode);
    setRandomizeItems(localRandomizeItems);

    // Apply validated game settings
    Object.entries(validatedSettings).forEach(([mode, settings]) => {
      Object.entries(settings as Record<string, unknown>).forEach(([setting, value]) => {
        setGameSetting(mode as any, setting, value as number);
      });
    });

    setHasChanges(false);
    onClose();
  };

  const handleSaveAndClose = () => {
    if (hasChanges) {
      handleSave();
    } else {
      onClose();
    }
  };

  const handleGameSettingChange = (mode: string, setting: string, value: number) => {
    setLocalGameSettings({
      ...localGameSettings,
      [mode]: {
        ...localGameSettings[mode as keyof typeof localGameSettings],
        [setting]: value,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="compact-settings">
        <div className="compact-settings__container">
          <div className="compact-settings__header">
            <div className="compact-settings__title-section">
              <Settings className="compact-settings__icon" />
              <h2 className="compact-settings__title">{t('modals.advancedSettings')}</h2>
            </div>
            <button onClick={onClose} className="modal__close-btn" aria-label={t('common.close')}>
              <X className="modal__close-icon" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="compact-settings__tabs">
            <button
              onClick={() => setActiveTab('general')}
              className={`compact-settings__tab ${activeTab === 'general' ? 'compact-settings__tab--active' : ''}`}
            >
              <Palette className="compact-settings__tab-icon" />
              <span className="compact-settings__tab-title">{t('settings.tabGeneral')}</span>
            </button>
            <button
              onClick={() => setActiveTab('games')}
              className={`compact-settings__tab ${activeTab === 'games' ? 'compact-settings__tab--active' : ''}`}
            >
              <Gamepad2 className="compact-settings__tab-icon" />
              <span className="compact-settings__tab-title">{t('settings.tabGames')}</span>
            </button>
            <button
              onClick={() => setActiveTab('offline')}
              className={`compact-settings__tab ${activeTab === 'offline' ? 'compact-settings__tab--active' : ''}`}
            >
              <WifiOff className="compact-settings__tab-icon" />
              <span className="compact-settings__tab-title">{t('settings.tabOffline')}</span>
            </button>
          </div>

          <div className="compact-settings__content">
            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <div className="compact-settings__section">
                <div className="compact-settings__fields">
                  <div className="compact-settings__field">
                    <label className="compact-settings__label">{t('settings.theme')}</label>
                    <select
                      className="compact-settings__select"
                      value={localTheme}
                      onChange={e => setLocalTheme(e.target.value as 'light' | 'dark')}
                    >
                      <option value="light">☀️ {t('settings.light')}</option>
                      <option value="dark">🌙 {t('settings.dark')}</option>
                    </select>
                  </div>

                  <div className="compact-settings__field">
                    <label className="compact-settings__label">{t('settings.language')}</label>
                    <select
                      className="compact-settings__select"
                      value={localLanguage}
                      onChange={e => setLocalLanguage(e.target.value as 'en' | 'es')}
                    >
                      <option value="en">{t('settings.langEnglish')}</option>
                      <option value="es">{t('settings.langSpanish')}</option>
                    </select>
                  </div>

                  <div className="compact-settings__field">
                    <label className="compact-settings__label">{t('settings.level')}</label>
                    <select
                      className="compact-settings__select"
                      value={localLevel}
                      onChange={e => setLocalLevel(e.target.value as any)}
                    >
                      <option value="all">🌟 {t('settings.all')}</option>
                      <option value="a1">🟢 A1</option>
                      <option value="a2">🟡 A2</option>
                      <option value="b1">🟠 B1</option>
                      <option value="b2">🔴 B2</option>
                      <option value="c1">🟣 C1</option>
                      <option value="c2">⚫ C2</option>
                    </select>
                  </div>

                  <div className="compact-settings__toggles-row">
                    <div className="compact-settings__field compact-settings__field--dev">
                      <div className="compact-settings__toggle-container">
                        <label
                          className="compact-settings__label compact-settings__label--dev"
                          title={t(
                            'settings.developmentModeDescription',
                            'Unlock all modes for testing'
                          )}
                        >
                          🔧 Dev Mode
                        </label>
                        <input
                          type="checkbox"
                          id="developmentMode"
                          className="compact-settings__toggle"
                          checked={localDevelopmentMode}
                          onChange={e => setLocalDevelopmentMode(e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="compact-settings__field compact-settings__field--dev">
                      <div className="compact-settings__toggle-container">
                        <label
                          className="compact-settings__label compact-settings__label--dev"
                          title={t(
                            'settings.randomizeItemsDescription',
                            'Shuffle cards, questions and exercises in random order'
                          )}
                        >
                          🎲 Randomize
                        </label>
                        <input
                          type="checkbox"
                          id="randomizeItems"
                          className="compact-settings__toggle"
                          checked={localRandomizeItems}
                          onChange={e => setLocalRandomizeItems(e.target.checked)}
                        />
                      </div>
                    </div>
                  </div>


                </div>
              </div>
            )}

            {/* Games Settings Tab */}
            {activeTab === 'games' && (
              <div className="compact-settings__section">
                <div className="compact-settings__games">
                  <div className="compact-settings__game">
                    <label className="compact-settings__game-label">
                      📚 {t('settings.flashcardMode')}
                    </label>
                    <div className="compact-settings__game-stepper">
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--minus"
                        onClick={() =>
                          handleGameSettingChange(
                            'flashcardMode',
                            'wordCount',
                            Math.max(5, (localGameSettings.flashcardMode.wordCount || 10) - 1)
                          )
                        }
                        disabled={(localGameSettings.flashcardMode.wordCount || 10) <= 5}
                        aria-label={t('settings.decreaseFlashcardCount')}
                      >
                        −
                      </button>
                      <span className="compact-settings__stepper-value">
                        {localGameSettings.flashcardMode.wordCount || 10}
                      </span>
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--plus"
                        onClick={() =>
                          handleGameSettingChange(
                            'flashcardMode',
                            'wordCount',
                            Math.min(30, (localGameSettings.flashcardMode.wordCount || 10) + 1)
                          )
                        }
                        disabled={(localGameSettings.flashcardMode.wordCount || 10) >= 30}
                        aria-label={t('settings.increaseFlashcardCount')}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="compact-settings__game">
                    <label className="compact-settings__game-label">
                      ❓ {t('settings.quizMode')}
                    </label>
                    <div className="compact-settings__game-stepper">
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--minus"
                        onClick={() =>
                          handleGameSettingChange(
                            'quizMode',
                            'questionCount',
                            Math.max(5, (localGameSettings.quizMode.questionCount || 10) - 1)
                          )
                        }
                        disabled={(localGameSettings.quizMode.questionCount || 10) <= 5}
                        aria-label={t('settings.decreaseQuizCount')}
                      >
                        −
                      </button>
                      <span className="compact-settings__stepper-value">
                        {localGameSettings.quizMode.questionCount || 10}
                      </span>
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--plus"
                        onClick={() =>
                          handleGameSettingChange(
                            'quizMode',
                            'questionCount',
                            Math.min(25, (localGameSettings.quizMode.questionCount || 10) + 1)
                          )
                        }
                        disabled={(localGameSettings.quizMode.questionCount || 10) >= 25}
                        aria-label={t('settings.increaseQuizCount')}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="compact-settings__game">
                    <label className="compact-settings__game-label">
                      ✏️ {t('settings.completionMode')}
                    </label>
                    <div className="compact-settings__game-stepper">
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--minus"
                        onClick={() =>
                          handleGameSettingChange(
                            'completionMode',
                            'itemCount',
                            Math.max(5, (localGameSettings.completionMode.itemCount || 10) - 1)
                          )
                        }
                        disabled={(localGameSettings.completionMode.itemCount || 10) <= 5}
                        aria-label={t('settings.decreaseCompletionCount')}
                      >
                        −
                      </button>
                      <span className="compact-settings__stepper-value">
                        {localGameSettings.completionMode.itemCount || 10}
                      </span>
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--plus"
                        onClick={() =>
                          handleGameSettingChange(
                            'completionMode',
                            'itemCount',
                            Math.min(20, (localGameSettings.completionMode.itemCount || 10) + 1)
                          )
                        }
                        disabled={(localGameSettings.completionMode.itemCount || 10) >= 20}
                        aria-label={t('settings.increaseCompletionCount')}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="compact-settings__game">
                    <label className="compact-settings__game-label">
                      🔄 {t('settings.sortingMode')}
                    </label>
                    <div className="compact-settings__game-stepper">
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--minus"
                        onClick={() =>
                          handleGameSettingChange(
                            'sortingMode',
                            'wordCount',
                            Math.max(8, (localGameSettings.sortingMode.wordCount || 12) - 1)
                          )
                        }
                        disabled={(localGameSettings.sortingMode.wordCount || 12) <= 8}
                        aria-label={t('settings.decreaseSortingCount')}
                      >
                        −
                      </button>
                      <span className="compact-settings__stepper-value">
                        {localGameSettings.sortingMode.wordCount || 12}
                      </span>
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--plus"
                        onClick={() =>
                          handleGameSettingChange(
                            'sortingMode',
                            'wordCount',
                            Math.min(20, (localGameSettings.sortingMode.wordCount || 12) + 1)
                          )
                        }
                        disabled={(localGameSettings.sortingMode.wordCount || 12) >= 20}
                        aria-label={t('settings.increaseSortingCount')}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="compact-settings__game">
                    <label className="compact-settings__game-label">
                      🔗 {t('settings.matchingMode')}
                    </label>
                    <div className="compact-settings__game-stepper">
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--minus"
                        onClick={() =>
                          handleGameSettingChange(
                            'matchingMode',
                            'wordCount',
                            Math.max(4, (localGameSettings.matchingMode.wordCount || 6) - 1)
                          )
                        }
                        disabled={(localGameSettings.matchingMode.wordCount || 6) <= 4}
                        aria-label={t('settings.decreaseMatchingCount')}
                      >
                        −
                      </button>
                      <span className="compact-settings__stepper-value">
                        {localGameSettings.matchingMode.wordCount || 6}
                      </span>
                      <button
                        type="button"
                        className="compact-settings__stepper-btn compact-settings__stepper-btn--plus"
                        onClick={() =>
                          handleGameSettingChange(
                            'matchingMode',
                            'wordCount',
                            Math.min(12, (localGameSettings.matchingMode.wordCount || 6) + 1)
                          )
                        }
                        disabled={(localGameSettings.matchingMode.wordCount || 6) >= 12}
                        aria-label={t('settings.increaseMatchingCount')}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Offline Tab */}
            {activeTab === 'offline' && (
              <div className="compact-settings__section">
                <div className="compact-settings__fields">
                  <div className="compact-settings__offline-toggle">
                    <div className="compact-settings__toggle-container">
                      <label className="compact-settings__label">
                        <WifiOff className="compact-settings__offline-icon" />
                        {t('offline.title')}:{' '}
                        {offlineEnabled && downloadedLevels.length > 0
                          ? t('offline.enabled')
                          : t('offline.disabled')}
                      </label>
                      <input
                        type="checkbox"
                        id="offlineMode"
                        className="compact-settings__toggle"
                        checked={offlineEnabled}
                        onChange={e => handleToggleOffline(e.target.checked)}
                        disabled={!cacheSupported}
                      />
                    </div>
                  </div>

                  {offlineEnabled && (
                    <>
                      <div className="compact-settings__offline-levels">
                        <span className="compact-settings__offline-levels-label">
                          {t('offline.selectLevels')}
                        </span>
                        <div className="compact-settings__offline-levels-grid">
                          {allLevels.map(lvl => (
                            <label key={lvl} className="compact-settings__offline-level-item">
                              <input
                                type="checkbox"
                                checked={selectedLevels.includes(lvl)}
                                onChange={e => handleLevelCheckbox(lvl, e.target.checked)}
                                disabled={isDownloading}
                              />
                              <span>{lvl.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                        <button
                          className="compact-settings__offline-download-btn"
                          onClick={() => {
                            handleDownload();
                          }}
                          disabled={selectedLevels.length === 0 || isDownloading}
                        >
                          {isDownloading ? t('offline.downloading') : t('offline.download')}
                        </button>
                      </div>

                      {isDownloading && downloadProgress && (
                        <div className="compact-settings__offline-progress">
                          <div className="compact-settings__offline-progress-bar">
                            <div
                              className="compact-settings__offline-progress-fill"
                              style={{
                                width: `${downloadProgress.total > 0 ? (downloadProgress.completed / downloadProgress.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="compact-settings__offline-progress-text">
                            {downloadProgress.completed}/{downloadProgress.total}
                          </span>
                        </div>
                      )}

                      {failedUrls.length > 0 && !isDownloading && (
                        <div className="compact-settings__offline-failed">
                          <span>
                            {t('offline.filesFailedCount', undefined, { count: failedUrls.length })}
                          </span>
                          <button
                            className="compact-settings__offline-retry-btn"
                            onClick={handleRetryFailed}
                          >
                            {t('offline.retryFailed')}
                          </button>
                        </div>
                      )}

                      {downloadedLevels.length > 0 && (
                        <div className="compact-settings__offline-storage">
                          <span>
                            {t('offline.storage')}: {formatStorageSize(totalCacheSize)}
                          </span>
                          <button
                            className="compact-settings__offline-manage-btn"
                            onClick={() => setIsModalOpen(true)}
                          >
                            {t('offline.manageDownloads')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="modal__actions modal__actions--single">
            <button
              onClick={handleSaveAndClose}
              className="modal__btn modal__btn--primary"
              aria-label={hasChanges ? t('common.save') : t('common.close')}
            >
              <Save className="modal__btn-icon" />
              {hasChanges ? t('common.save') : t('common.close')}
            </button>
          </div>
        </div>
      </div>

      <DownloadManagerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
