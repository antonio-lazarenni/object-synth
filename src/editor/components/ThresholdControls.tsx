type Props = {
  imageFilterThreshold: number;
  movementThreshold: number;
  onImageFilterThresholdChange: (value: number) => void;
  onMovementThresholdChange: (value: number) => void;
};

export const ThresholdControls = ({
  imageFilterThreshold,
  movementThreshold,
  onImageFilterThresholdChange,
  onMovementThresholdChange,
}: Props) => {
  return (
    <div className="card border border-base-300 bg-base-200/60">
      <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Detection Tuning</h3>

        <div className="form-control gap-1.5">
          <div className="flex items-center justify-between">
            <span className="label-text">Image filter threshold</span>
            <span className="badge badge-outline">{imageFilterThreshold.toFixed(2)}</span>
          </div>
          <input
            className="range range-primary range-xs md:range-sm"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={imageFilterThreshold}
            onChange={(event) => onImageFilterThresholdChange(Number(event.target.value))}
          />
        </div>

        <div className="form-control gap-1.5">
          <div className="flex items-center justify-between">
            <span className="label-text">Movement threshold</span>
            <span className="badge badge-outline">{movementThreshold.toFixed(2)}</span>
          </div>
          <input
            className="range range-secondary range-xs md:range-sm"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={movementThreshold}
            onChange={(event) => onMovementThresholdChange(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
};
