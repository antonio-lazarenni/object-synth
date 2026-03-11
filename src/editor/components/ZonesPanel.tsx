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
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Active zones
          <input
            className="w-24 rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
            type="number"
            min={1}
            value={zones.length}
            onChange={(event) => onSetCount(Number(event.target.value))}
          />
        </label>
        <button
          className="rounded bg-red-700 px-3 py-1 text-sm hover:bg-red-600"
          onClick={onResetZones}
        >
          Reset zones
        </button>
        <label className="flex flex-col gap-1 text-sm">
          Default detection
          <select
            className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
            value={defaultDetectionMode}
            onChange={(event) => onSetDefaultDetectionMode(event.target.value as DetectionMode)}
          >
            <option value="motion">Motion</option>
            <option value="presence">Presence</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {zones.map((zone, index) => (
          <div key={zone.id} className="rounded border border-emerald-900 p-3">
            <div className="mb-2 text-sm font-semibold">Zone {index}</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                Sound
                <select
                  className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
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
              <label className="flex flex-col gap-1 text-sm">
                Pan: {(zone.pan ?? 0).toFixed(1)}
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={zone.pan ?? 0}
                  onChange={(event) => onSetZonePan(index, Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Volume: {(zone.volume ?? 0.5).toFixed(2)}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={zone.volume ?? 0.5}
                  onChange={(event) => onSetZoneVolume(index, Number(event.target.value))}
                />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Detection mode
                <select
                  className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
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
              <label className="mt-5 flex items-center gap-2 text-sm md:mt-6">
                <input
                  type="checkbox"
                  checked={zone.stopOnLeave ?? false}
                  onChange={(event) => onSetZoneStopOnLeave(index, event.target.checked)}
                />
                Stop zone audio on leave
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={zone.overdub ?? true}
                onChange={(event) => onSetZoneOverdub(index, event.target.checked)}
              />
              Overdub (allow retrigger while playing)
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
