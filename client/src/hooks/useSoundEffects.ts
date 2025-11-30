import { useCallback, useRef, useEffect, useState } from 'react';

export type SoundEffect = 
  | 'messageSent' 
  | 'messageReceived' 
  | 'taskComplete' 
  | 'error' 
  | 'notification'
  | 'success'
  | 'warning';

interface SoundSettings {
  enabled: boolean;
  volume: number;
  effects: Record<SoundEffect, boolean>;
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 50,
  effects: {
    messageSent: true,
    messageReceived: true,
    taskComplete: true,
    error: true,
    notification: true,
    success: true,
    warning: true,
  },
};

const SOUND_FREQUENCIES: Record<SoundEffect, { freq: number; duration: number; type: OscillatorType }> = {
  messageSent: { freq: 880, duration: 100, type: 'sine' },
  messageReceived: { freq: 660, duration: 120, type: 'sine' },
  taskComplete: { freq: 523, duration: 200, type: 'triangle' },
  error: { freq: 200, duration: 300, type: 'sawtooth' },
  notification: { freq: 784, duration: 150, type: 'sine' },
  success: { freq: 1047, duration: 180, type: 'sine' },
  warning: { freq: 440, duration: 250, type: 'square' },
};

const STORAGE_KEY = 'beehive-sound-settings';

export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [settings, setSettings] = useState<SoundSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
    }
  }, [settings]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((effect: SoundEffect) => {
    if (!settings.enabled || !settings.effects[effect]) return;

    try {
      const ctx = getAudioContext();
      const config = SOUND_FREQUENCIES[effect];
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.freq, ctx.currentTime);
      
      const normalizedVolume = settings.volume / 100;
      gainNode.gain.setValueAtTime(normalizedVolume * 0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration / 1000);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration / 1000);
    } catch (err) {
      console.warn('[SoundEffects] Failed to play sound:', err);
    }
  }, [settings, getAudioContext]);

  const playChime = useCallback((notes: number[] = [523, 659, 784]) => {
    if (!settings.enabled) return;

    try {
      const ctx = getAudioContext();
      const normalizedVolume = settings.volume / 100;
      
      notes.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
        
        const startTime = ctx.currentTime + i * 0.1;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(normalizedVolume * 0.2, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
      });
    } catch (err) {
      console.warn('[SoundEffects] Failed to play chime:', err);
    }
  }, [settings, getAudioContext]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(100, volume)) }));
  }, []);

  const setEffectEnabled = useCallback((effect: SoundEffect, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      effects: { ...prev.effects, [effect]: enabled },
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    playSound,
    playChime,
    settings,
    setEnabled,
    setVolume,
    setEffectEnabled,
  };
}
