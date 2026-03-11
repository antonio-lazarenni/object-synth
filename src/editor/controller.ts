import { P5EngineAdapter } from '../engine/p5Engine';
import { setEditorStatePartial, useEditorStore } from './state';
import { MODE, type DetectionMode, type EditorState } from './types';

const engine = new P5EngineAdapter({
  onStateChange: (partial) => setEditorStatePartial(partial),
});

export const mountEngine = (container: HTMLElement): void => {
  engine.init(container);
};

export const unmountEngine = (): void => {
  engine.destroy();
};

export const useEditorState = () => useEditorStore((state: EditorState) => state);

export const editorActions = {
  setMode: (mode: MODE) => engine.setMode(mode),
  setActiveZoneCount: (count: number) => engine.setActiveZoneCount(count),
  resetZones: () => engine.resetZones(),
  setSelectedVideoDevice: (deviceId: string | null) => engine.setSelectedVideoDevice(deviceId),
  setProcessResolution: (w: number, h: number) => engine.setProcessResolution(w, h),
  setShowFps: (show: boolean) => engine.setShowFps(show),
  setImageFilterThreshold: (value: number) => engine.setImageFilterThreshold(value),
  setMovementThreshold: (value: number) => engine.setMovementThreshold(value),
  setDefaultDetectionMode: (mode: DetectionMode) => engine.setDefaultDetectionMode(mode),
  addSoundFiles: (files: File[]) => engine.addSoundFiles(files),
  loadSoundsFromDirectory: () => engine.loadSoundsFromDirectory(),
  resetSoundLibrary: () => engine.resetSoundLibrary(),
  playSound: (soundId: string) => engine.playSound(soundId),
  deleteSound: (soundId: string) => engine.deleteSound(soundId),
  setBackgroundSound: (soundId: string | null) => engine.setBackgroundSound(soundId),
  setBackgroundVolume: (volume: number) => engine.setBackgroundVolume(volume),
  setZoneSound: (index: number, soundId: string) => engine.setZoneSound(index, soundId),
  setZonePan: (index: number, pan: number) => engine.setZonePan(index, pan),
  setZoneVolume: (index: number, volume: number) => engine.setZoneVolume(index, volume),
  setZoneOverdub: (index: number, overdub: boolean) => engine.setZoneOverdub(index, overdub),
  setZoneDetectionMode: (index: number, mode: DetectionMode | null) =>
    engine.setZoneDetectionMode(index, mode),
  setZoneStopOnLeave: (index: number, enabled: boolean) => engine.setZoneStopOnLeave(index, enabled),
};
