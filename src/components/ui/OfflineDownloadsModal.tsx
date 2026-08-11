import React, { useState, useEffect, useCallback } from 'react';
import { X, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
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

interface OfflineDownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineDownloadsModal: React.FC<OfflineDownloadsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    language,
    level,
    offlineEnabled,
    downloadedLevels,
    setOfflineEnabled,
    setDownloadedLevels,
    setLastDownloadDate,
  } = useSettingsStore();

  const { t } = useTranslation(language);

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

  useEffect(() => {
    if (!isOpen) {
      // Reset download manager modal state when main modal closes
      setIsModalOpen(false);
    }
  }, [isOpen]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    [setOfflineEnabled, setDownloadedLevels, setLastDownloadDate]
  );

  const handleLevelCheckbox = useCallback((lvl: string, checked: boolean) => {
    setSelectedLevels(prev => (checked ? [...prev, lvl] : prev.filter(l => l !== lvl)));
  }, []);

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    if (selectedLevels.length === 0) {
      return;
    }

    setIsDownloading(true);
    setFailedUrls([]);
    setDownloadProgress(null);

    try {
      // Clean approach: delete all cache and re-download only selected levels
      // This ensures consistency between selected levels and cached content
      await deleteAllCache();

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

      const size = await getTotalCacheSize();
      setTotalCacheSize(size);
    } catch (error) {
      logError('Download error', { error }, 'OfflineDownloadsModal');
    } finally {
      setIsDownloading(false);
    }
  }, [selectedLevels, isDownloading, setDownloadedLevels, setLastDownloadDate]);

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

  if (!isOpen) return null;

  return (
    <>
      <div className="compact-settings">
        <div className="compact-settings__container">
          <div className="compact-settings__header">
            <h2 className="compact-settings__title">{t('offline.title')}</h2>
            <button
              onClick={onClose}
              className="compact-settings__close"
              type="button"
              aria-label={t('common.close')}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="compact-settings__content">
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
          </div>
          <div className="compact-settings__footer">
            <button
              onClick={onClose}
              className="compact-settings__done"
              type="button"
              aria-label={t('common.close')}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      <DownloadManagerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
