import { PROCESS_RESOLUTIONS } from '../types';

type Props = {
  processWidth: number;
  processHeight: number;
  showFpsDisplay: boolean;
  onChangeResolution: (width: number, height: number) => void;
  onToggleFps: (show: boolean) => void;
};

export const PerformanceControls = ({
  processWidth,
  processHeight,
  showFpsDisplay,
  onChangeResolution,
  onToggleFps,
}: Props) => {
  const value = `${processWidth}x${processHeight}`;

  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1 text-sm">
        Process resolution
        <select
          className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
          value={value}
          onChange={(event) => {
            const [w, h] = event.target.value.split('x').map(Number);
            onChangeResolution(w, h);
          }}
        >
          {PROCESS_RESOLUTIONS.map((option) => (
            <option key={option.label} value={`${option.w}x${option.h}`}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <input
          className="mr-1"
          type="checkbox"
          checked={showFpsDisplay}
          onChange={(event) => onToggleFps(event.target.checked)}
        />
        Show FPS
      </label>
    </div>
  );
};
