/**
 * FluentFlow — Web Speech API TTS utility
 * Minimal, reliable implementation. Always speaks using browser default if needed.
 */

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
}

export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isSpeechAvailable() || !text) return;

  const { lang = 'en-US', rate = 0.9, pitch = 1 } = opts;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (isSpeechAvailable()) {
    window.speechSynthesis.cancel();
  }
}

export function preloadVoices(): void {
  if (!isSpeechAvailable()) return;
  window.speechSynthesis.getVoices();
}
