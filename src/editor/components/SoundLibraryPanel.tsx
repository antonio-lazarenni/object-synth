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
    <div className="space-y-3 md:space-y-4">
      <section className="card border border-base-300 bg-base-200/60">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Library Actions</h3>
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-sm md:btn-md btn-primary">
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
            <button className="btn btn-sm md:btn-md btn-secondary" onClick={onSelectDirectory} type="button">
              Select sounds directory
            </button>
            <button className="btn btn-sm md:btn-md btn-error btn-outline" onClick={onReset} type="button">
              Reset library
            </button>
          </div>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-200/60">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Background Track</h3>
            <span className="badge badge-outline">{backgroundVolume.toFixed(2)}</span>
          </div>
          <label className="form-control">
            <span className="label-text mb-1">Track</span>
            <select
              className="select select-bordered select-sm md:select-md w-full"
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
          <div className="form-control gap-1.5">
            <div className="flex items-center justify-between">
              <span className="label-text">Volume</span>
              <span className="badge badge-outline">{backgroundVolume.toFixed(2)}</span>
            </div>
            <input
              className="range range-accent range-xs md:range-sm"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={backgroundVolume}
              onChange={(event) => onSetBackgroundVolume(Number(event.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Sounds</h3>
            <span className="badge badge-ghost">{sounds.length}</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 xl:max-h-80">
            {sounds.map((sound) => (
              <div key={sound.id} className="flex items-center justify-between gap-2 rounded-box border border-base-300 bg-base-200/65 px-2 py-1.5">
                <span className="truncate text-sm">{sound.name}</span>
                <div className="flex shrink-0 gap-2">
                  <button className="btn btn-xs btn-info btn-outline min-h-0 h-7" onClick={() => onPlay(sound.id)} type="button">
                    Play
                  </button>
                  <button className="btn btn-xs btn-error btn-outline min-h-0 h-7" onClick={() => onDelete(sound.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {sounds.length === 0 ? <p className="text-sm text-base-content/60">No sounds loaded yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
};
