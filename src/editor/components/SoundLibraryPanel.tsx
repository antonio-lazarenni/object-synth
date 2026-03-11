import type { SoundFile } from '../types';

type Props = {
  sounds: SoundFile[];
  backgroundSoundId: string | null;
  backgroundVolume: number;
  onFilesSelected: (files: File[]) => void;
  onSelectDirectory: () => void;
  onReset: () => void;
  onPlay: (soundId: string) => void;
  onDelete: (soundId: string) => void;
  onSetBackgroundSound: (soundId: string | null) => void;
  onSetBackgroundVolume: (value: number) => void;
};

export const SoundLibraryPanel = ({
  sounds,
  backgroundSoundId,
  backgroundVolume,
  onFilesSelected,
  onSelectDirectory,
  onReset,
  onPlay,
  onDelete,
  onSetBackgroundSound,
  onSetBackgroundVolume,
}: Props) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="rounded bg-emerald-800 px-3 py-1 text-sm hover:bg-emerald-700">
          Add sound files
          <input
            className="hidden"
            type="file"
            accept="audio/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) onFilesSelected(files);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <button
          className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600"
          onClick={onSelectDirectory}
          type="button"
        >
          Select sounds directory
        </button>
        <button
          className="rounded bg-red-700 px-3 py-1 text-sm hover:bg-red-600"
          onClick={onReset}
          type="button"
        >
          Reset library
        </button>
      </div>

      <div className="space-y-2 rounded border border-emerald-900 p-3">
        <div className="text-sm font-semibold">Background sound</div>
        <label className="flex flex-col gap-1 text-sm">
          Track
          <select
            className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
            value={backgroundSoundId ?? ''}
            onChange={(event) => onSetBackgroundSound(event.target.value || null)}
          >
            <option value="">None</option>
            {sounds.map((sound) => (
              <option key={sound.id} value={sound.id}>
                {sound.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Volume: {backgroundVolume.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={backgroundVolume}
            onChange={(event) => onSetBackgroundVolume(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-emerald-900 p-3">
        <div className="text-sm font-semibold">Total sounds: {sounds.length}</div>
        {sounds.map((sound) => (
          <div key={sound.id} className="flex items-center justify-between gap-2 rounded bg-emerald-950 p-2">
            <span className="truncate text-sm">{sound.name}</span>
            <div className="flex gap-2">
              <button className="rounded bg-sky-700 px-2 py-1 text-xs" onClick={() => onPlay(sound.id)} type="button">
                Play
              </button>
              <button
                className="rounded bg-red-700 px-2 py-1 text-xs"
                onClick={() => onDelete(sound.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
