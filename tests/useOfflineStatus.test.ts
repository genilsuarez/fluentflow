import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineStatus } from '../src/hooks/useOfflineStatus';
import { useSettingsStore } from '../src/stores/settingsStore';

describe('useOfflineStatus', () => {
  let onlineGetter: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset store state
    useSettingsStore.setState({
      offlineEnabled: false,
      downloadedLevels: [],
    });
    // Default: online
    onlineGetter = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => {
    onlineGetter.mockRestore();
  });

  it('should return isOnline true when navigator.onLine is true', () => {
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('should return isOnline false when navigator.onLine is false', () => {
    onlineGetter.mockReturnValue(false);
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('should react to window offline event', () => {
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      onlineGetter.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should react to window online event', () => {
    onlineGetter.mockReturnValue(false);
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      onlineGetter.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('should clean up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOfflineStatus());

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('should return isOfflineMode false when online', () => {
    useSettingsStore.setState({ offlineEnabled: true, downloadedLevels: ['a1'] });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOfflineMode).toBe(false);
  });

  it('should return isOfflineMode true when offline + enabled + has downloads', () => {
    onlineGetter.mockReturnValue(false);
    useSettingsStore.setState({ offlineEnabled: true, downloadedLevels: ['a1'] });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOfflineMode).toBe(true);
  });

  it('should return isOfflineMode false when offline but not enabled', () => {
    onlineGetter.mockReturnValue(false);
    useSettingsStore.setState({ offlineEnabled: false, downloadedLevels: ['a1'] });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOfflineMode).toBe(false);
  });

  it('should return isOfflineMode false when offline + enabled but no downloads', () => {
    onlineGetter.mockReturnValue(false);
    useSettingsStore.setState({ offlineEnabled: true, downloadedLevels: [] });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOfflineMode).toBe(false);
  });

  it('should update isOfflineMode reactively when going offline', () => {
    useSettingsStore.setState({ offlineEnabled: true, downloadedLevels: ['a1', 'b1'] });
    const { result } = renderHook(() => useOfflineStatus());

    expect(result.current.isOfflineMode).toBe(false);

    act(() => {
      onlineGetter.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOfflineMode).toBe(true);
  });
});
