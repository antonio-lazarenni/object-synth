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
    <div className="card border border-base-300 bg-base-200/60">
      <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Processing</h3>
        <label className="form-control w-full">
          <span className="label-text mb-1">Process resolution</span>
          <select
            className="select select-bordered select-sm md:select-md w-full"
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
        <label className="label cursor-pointer justify-start gap-3 py-1">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={showFpsDisplay}
            onChange={(event) => onToggleFps(event.target.checked)}
          />
          <span className="label-text">Show FPS overlay</span>
        </label>
      </div>
    </div>
  );
};
