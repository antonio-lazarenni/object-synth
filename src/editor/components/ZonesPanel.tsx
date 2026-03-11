import type { DetectionMode, SoundFile, Zone } from '../types';

type Props = {
  zones: Zone[];
  sounds: SoundFile[];
  defaultDetectionMode: DetectionMode;
  onSetCount: (count: number) => void;
  onResetZones: () => void;
  onSetDefaultDetectionMode: (mode: DetectionMode) => void;
  onSetZoneSound: (index: number, soundId: string) => void;
  onSetZonePan: (index: number, pan: number) => void;
  onSetZoneVolume: (index: number, volume: number) => void;
  onSetZoneOverdub: (index: number, overdub: boolean) => void;
  onSetZoneDetectionMode: (index: number, mode: DetectionMode | null) => void;
  onSetZoneStopOnLeave: (index: number, enabled: boolean) => void;
};

export const ZonesPanel = ({
  zones,
  sounds,
  defaultDetectionMode,
  onSetCount,
  onResetZones,
  onSetDefaultDetectionMode,
  onSetZoneSound,
  onSetZonePan,
  onSetZoneVolume,
  onSetZoneOverdub,
  onSetZoneDetectionMode,
  onSetZoneStopOnLeave,
}: Props) => {
  return (
    <div className="space-y-3 md:space-y-4">
      <section className="card border border-base-300 bg-base-200/60">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Zones Management</h3>
            <span className="badge badge-outline">Total zones: {zones.length}</span>
          </div>
          <div className="grid gap-2.5 md:gap-3 md:grid-cols-2 xl:grid-cols-[180px_1fr_auto]">
            <label className="form-control">
              <span className="label-text mb-1">Active zones</span>
              <input
                className="input input-bordered input-sm md:input-md w-full"
                type="number"
                min={1}
                value={zones.length}
                onChange={(event) => onSetCount(Number(event.target.value))}
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Default detection</span>
              <select
                className="select select-bordered select-sm md:select-md w-full"
                value={defaultDetectionMode}
                onChange={(event) => onSetDefaultDetectionMode(event.target.value as DetectionMode)}
              >
                <option value="motion">Motion</option>
                <option value="presence">Presence</option>
              </select>
            </label>
            <button className="btn btn-sm md:btn-md btn-error btn-outline md:col-span-2 xl:col-span-1 xl:self-end" onClick={onResetZones} type="button">
              Reset zones
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-2.5 md:space-y-3">
        {zones.map((zone, index) => (
          <article key={zone.id} className="card border border-base-300 bg-base-100 shadow">
            <div className="card-body gap-3 p-3 md:gap-4 md:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold">Zone {index}</h4>
                <span className="badge badge-ghost">{String(zone.id).slice(0, 8)}</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 md:gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <label className="form-control">
                  <span className="label-text mb-1">Sound</span>
                  <select
                    className="select select-bordered select-sm md:select-md w-full"
                    value={zone.soundId || ''}
                    onChange={(event) => onSetZoneSound(index, event.target.value)}
                  >
                    <option value="">No sound</option>
                    {sounds.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {sound.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-control gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="label-text">Pan</span>
                    <span className="badge badge-outline">{(zone.pan ?? 0).toFixed(1)}</span>
                  </div>
                  <input
                    className="range range-primary range-xs md:range-sm"
                    type="range"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={zone.pan ?? 0}
                    onChange={(event) => onSetZonePan(index, Number(event.target.value))}
                  />
                </div>

                <div className="form-control gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="label-text">Volume</span>
                    <span className="badge badge-outline">{(zone.volume ?? 0.5).toFixed(2)}</span>
                  </div>
                  <input
                    className="range range-secondary range-xs md:range-sm"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={zone.volume ?? 0.5}
                    onChange={(event) => onSetZoneVolume(index, Number(event.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 md:gap-3 lg:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-1">Detection mode</span>
                  <select
                    className="select select-bordered select-sm md:select-md w-full"
                    value={zone.detectionMode ?? 'default'}
                    onChange={(event) =>
                      onSetZoneDetectionMode(
                        index,
                        event.target.value === 'default'
                          ? null
                          : (event.target.value as DetectionMode)
                      )
                    }
                  >
                    <option value="default">Default ({defaultDetectionMode})</option>
                    <option value="motion">Motion</option>
                    <option value="presence">Presence</option>
                  </select>
                </label>

                <div className="flex flex-col justify-end gap-2">
                  <label className="label cursor-pointer justify-start gap-3 py-1">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-info"
                      checked={zone.stopOnLeave ?? false}
                      onChange={(event) => onSetZoneStopOnLeave(index, event.target.checked)}
                    />
                    <span className="label-text">Stop zone audio on leave</span>
                  </label>
                  <label className="label cursor-pointer justify-start gap-3 py-1">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-accent"
                      checked={zone.overdub ?? true}
                      onChange={(event) => onSetZoneOverdub(index, event.target.checked)}
                    />
                    <span className="label-text">Overdub while playing</span>
                  </label>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
