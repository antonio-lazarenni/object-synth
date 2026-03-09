import type { EditorState } from '../types';
import { SoundLibraryPanel } from './SoundLibraryPanel';

type Props = {
  state: EditorState;
  actions: {
    addSoundFiles: (files: File[]) => Promise<void>;
    loadSoundsFromDirectory: () => Promise<void>;
    resetSoundLibrary: () => Promise<void>;
    playSound: (soundId: string) => void;
    deleteSound: (soundId: string) => Promise<void>;
    setBackgroundSound: (soundId: string | null) => void;
    setBackgroundVolume: (volume: number) => void;
  };
};

export const SoundLibraryTab = ({ state, actions }: Props) => {
  return (
    <SoundLibraryPanel
      sounds={state.sounds}
      backgroundSoundId={state.backgroundSoundId}
      backgroundVolume={state.backgroundVolume}
      onFilesSelected={(files) => {
        void actions.addSoundFiles(files);
      }}
      onSelectDirectory={() => {
        void actions.loadSoundsFromDirectory();
      }}
      onReset={() => {
        void actions.resetSoundLibrary();
      }}
      onPlay={actions.playSound}
      onDelete={(soundId) => {
        void actions.deleteSound(soundId);
      }}
      onSetBackgroundSound={actions.setBackgroundSound}
      onSetBackgroundVolume={actions.setBackgroundVolume}
    />
  );
};
