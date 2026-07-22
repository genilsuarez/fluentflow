/**
 * FluentFlow — Web Speech API TTS utility
 * Handles async voice loading (Chrome/Safari) and synthesis resume quirks.
 */

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
}

let voicesPromise: Promise<void> | null = null;
let cachedVoice: SpeechSynthesisVoice | null = null;

export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const langPrefix = lang.split('-')[0]?.toLowerCase() ?? 'en';
  const matching = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  const pool = matching.length > 0 ? matching : voices;

  return (
    pool.find(v => v.localService && /google|samantha|daniel|karen|alex/i.test(v.name)) ??
    pool.find(v => v.localService) ??
    pool.find(v => v.default) ??
    pool[0] ??
    null
  );
}

function cachePreferredVoice(lang = 'en-US'): void {
  if (!isSpeechAvailable()) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  cachedVoice = pickVoice(voices, lang);
}

function ensureVoicesReady(): Promise<void> {
  if (!isSpeechAvailable()) return Promise.resolve();
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise(resolve => {
    const synth = window.speechSynthesis;

    const finish = () => {
      cachePreferredVoice();
      resolve();
    };

    if (synth.getVoices().length > 0) {
      finish();
      return;
    }

    const onVoicesChanged = () => {
      if (synth.getVoices().length > 0) {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        finish();
      }
    };

    synth.addEventListener('voiceschanged', onVoicesChanged);
    // Chrome loads voices asynchronously — getVoices() alone is not enough on first paint.
    synth.getVoices();

    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      finish();
    }, 1500);
  });

  return voicesPromise;
}

function resumeSynth(): void {
  if (!isSpeechAvailable()) return;
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isSpeechAvailable() || !text) return;

  const { lang = 'en-US', rate = 0.9, pitch = 1 } = opts;

  void ensureVoicesReady().then(() => {
    const synth = window.speechSynthesis;
    synth.cancel();
    resumeSynth();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    const voice = cachedVoice ?? pickVoice(synth.getVoices(), lang);
    if (voice) utterance.voice = voice;

    synth.speak(utterance);
    resumeSynth();
  });
}

export function stopSpeaking(): void {
  if (isSpeechAvailable()) {
    window.speechSynthesis.cancel();
  }
}

export function preloadVoices(): void {
  void ensureVoicesReady();
}

export function whenVoicesReady(): Promise<void> {
  return ensureVoicesReady();
}
