import type { SoundFile, Zone } from '../types';

type Props = {
  zones: Zone[];
  sounds: SoundFile[];
  onSetCount: (count: number) => void;
  onResetZones: () => void;
  onSetZoneSound: (index: number, soundId: string) => void;
  onSetZonePan: (index: number, pan: number) => void;
  onSetZoneVolume: (index: number, volume: number) => void;
};

export const ZonesPanel = ({
  zones,
  sounds,
  onSetCount,
  onResetZones,
  onSetZoneSound,
  onSetZonePan,
  onSetZoneVolume,
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
          </div>
        ))}
      </div>
    </div>
  );
};
