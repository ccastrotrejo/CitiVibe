import { useCallback, useEffect, useRef, useState } from 'react';
import { CityAudio } from '../world/audio';
import type { AudioStatus } from '../world/audio';
import type { Weather } from '../world/environment';

interface UseCityAudioOptions {
  paused: boolean;
  live: boolean;
  weather: Weather;
  volume: number;
}

export function useCityAudio({ paused, live, weather, volume }: UseCityAudioOptions) {
  const [status, setStatus] = useState<AudioStatus>({ state: 'off', message: 'Sound off. Enable sound to listen.' });
  const audio = useRef<CityAudio | null>(null);

  if (!audio.current) audio.current = new CityAudio(setStatus);

  useEffect(() => () => audio.current?.dispose(), []);

  useEffect(() => {
    audio.current?.setRunning(live && !paused);
  }, [live, paused]);

  useEffect(() => {
    audio.current?.setWeather(weather);
  }, [weather]);

  useEffect(() => {
    audio.current?.setVolume(volume);
  }, [volume]);

  const enable = useCallback(() => audio.current?.enable() ?? Promise.resolve(), []);
  const setMuted = useCallback((next: boolean) => audio.current?.setMuted(next) ?? Promise.resolve(), []);

  return { status, enable, setMuted };
}
