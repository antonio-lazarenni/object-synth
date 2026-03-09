import { editorActions } from '../controller';
import { useEditorStore } from '../state';
import { SoundLibraryPanel } from './SoundLibraryPanel';

export const SoundLibraryTab = () => {
  const sounds = useEditorStore((state) => state.sounds);
  const backgroundSoundId = useEditorStore((state) => state.backgroundSoundId);
  const backgroundVolume = useEditorStore((state) => state.backgroundVolume);

  return (
    <SoundLibraryPanel
      sounds={sounds}
      backgroundSoundId={backgroundSoundId}
      backgroundVolume={backgroundVolume}
      onFilesSelected={(files) => {
        void editorActions.addSoundFiles(files);
      }}
      onSelectDirectory={() => {
        void editorActions.loadSoundsFromDirectory();
      }}
      onReset={() => {
        void editorActions.resetSoundLibrary();
      }}
      onPlay={editorActions.playSound}
      onDelete={(soundId) => {
        void editorActions.deleteSound(soundId);
      }}
      onSetBackgroundSound={editorActions.setBackgroundSound}
      onSetBackgroundVolume={editorActions.setBackgroundVolume}
    />
  );
};
