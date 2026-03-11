import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  deleteLevelCache,
  deleteAllCache,
  getLevelStorageInfo,
  getTotalCacheSize,
  formatStorageSize,
} from '../../services/offlineManager';
import type { LevelStorageInfo } from '../../services/offlineManager';
import '../../styles/components/download-manager.css';
import '../../styles/components/modal-buttons.css';

interface DownloadManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadManagerModal: React.FC<DownloadManagerModalProps> = ({ isOpen, onClose }) => {
  const { language, downloadedLevels, setDownloadedLevels, setOfflineEnabled, setLastDownloadDate } =
    useSettingsStore();
  const { t } = useTranslation(language);

  const [levelInfo, setLevelInfo] = useState<LevelStorageInfo[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  useEscapeKey(isOpen, onClose);

  const refreshInfo = useCallback(async () => {
    const info = await getLevelStorageInfo();
    setLevelInfo(info);
    const size = await getTotalCacheSize();
    setTotalSize(size);
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshInfo();
    }
  }, [isOpen, refreshInfo]);

  const handleDeleteLevel = useCallback(async (level: string) => {
    await deleteLevelCache(level);
    const updatedLevels = downloadedLevels.filter(l => l !== level);
    setDownloadedLevels(updatedLevels);
    if (updatedLevels.length === 0) {
      setOfflineEnabled(false);
      setLastDownloadDate(null);
    }
    await refreshInfo();
  }, [downloadedLevels, setDownloadedLevels, setOfflineEnabled, setLastDownloadDate, refreshInfo]);

  const handleDeleteAll = useCallback(async () => {
    await deleteAllCache();
    setDownloadedLevels([]);
    setOfflineEnabled(false);
    setLastDownloadDate(null);
    onClose();
  }, [setDownloadedLevels, setOfflineEnabled, setLastDownloadDate, onClose]);

  if (!isOpen) return null;

  const hasDownloads = levelInfo.length > 0;

  return (
    <div className="download-manager">
      <div className="download-manager__container">
        <div className="download-manager__header">
          <h2 className="download-manager__title">{t('offline.manageDownloads')}</h2>
          <button onClick={onClose} className="modal__close-btn" aria-label={t('common.close')}>
            <X className="modal__close-icon" />
          </button>
        </div>

        <div className="download-manager__content">
          {hasDownloads ? (
            <>
              <ul className="download-manager__list">
                {levelInfo.map(info => (
                  <li key={info.level} className="download-manager__item">
                    <span className="download-manager__item-name">
                      {info.level.toUpperCase()}
                    </span>
                    <span className="download-manager__item-info">
                      {info.moduleCount} {info.moduleCount === 1 ? 'module' : 'modules'} · {formatStorageSize(info.sizeBytes)}
                    </span>
                    <button
                      className="download-manager__item-delete"
                      onClick={() => handleDeleteLevel(info.level)}
                      aria-label={`${t('offline.deleteLevel')} ${info.level.toUpperCase()}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="download-manager__total">
                <span>{t('offline.storage')}: {formatStorageSize(totalSize)}</span>
              </div>

              <div className="modal__actions">
                <button
                  className="download-manager__delete-all modal__btn modal__btn--primary"
                  onClick={handleDeleteAll}
                >
                  {t('offline.deleteAll')}
                </button>
              </div>
            </>
          ) : (
            <div className="download-manager__empty">
              <p>{t('offline.emptyState')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
