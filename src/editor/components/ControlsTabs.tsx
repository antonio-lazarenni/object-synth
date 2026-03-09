import { useState } from 'react';
import type { EditorState } from '../types';
import { ActiveAreasTab } from './ActiveAreasTab';
import { SoundLibraryTab } from './SoundLibraryTab';

type TabId = 'active-areas' | 'sound-library';

type Props = {
  state: EditorState;
  actions: {
    setMode: (mode: EditorState['mode']) => void;
    setSelectedVideoDevice: (deviceId: string | null) => void;
    setProcessResolution: (w: number, h: number) => void;
    setShowFps: (show: boolean) => void;
    setActiveZoneCount: (count: number) => void;
    resetZones: () => void;
    setZoneSound: (index: number, soundId: string) => void;
    setZonePan: (index: number, pan: number) => void;
    setZoneVolume: (index: number, volume: number) => void;
    setImageFilterThreshold: (value: number) => void;
    setMovementThreshold: (value: number) => void;
    addSoundFiles: (files: File[]) => Promise<void>;
    loadSoundsFromDirectory: () => Promise<void>;
    resetSoundLibrary: () => Promise<void>;
    playSound: (soundId: string) => void;
    deleteSound: (soundId: string) => Promise<void>;
    setBackgroundSound: (soundId: string | null) => void;
    setBackgroundVolume: (volume: number) => void;
  };
};

export const ControlsTabs = ({ state, actions }: Props) => {
  const [activeTab, setActiveTab] = useState<TabId>('active-areas');

  return (
    <div className="space-y-3 rounded-lg bg-emerald-900/40 p-3">
      <div className="flex gap-2">
        <button
          className={`rounded px-3 py-1 text-sm ${
            activeTab === 'active-areas' ? 'bg-emerald-700' : 'bg-emerald-950'
          }`}
          onClick={() => setActiveTab('active-areas')}
        >
          Active Areas
        </button>
        <button
          className={`rounded px-3 py-1 text-sm ${
            activeTab === 'sound-library' ? 'bg-emerald-700' : 'bg-emerald-950'
          }`}
          onClick={() => setActiveTab('sound-library')}
        >
          Sound Library
        </button>
      </div>

      {activeTab === 'active-areas' ? (
        <ActiveAreasTab state={state} actions={actions} />
      ) : (
        <SoundLibraryTab state={state} actions={actions} />
      )}
    </div>
  );
};
