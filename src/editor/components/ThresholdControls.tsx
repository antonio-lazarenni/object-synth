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
    <div className="space-y-2">
      <label className="flex flex-col gap-1 text-sm">
        Image filter threshold: {imageFilterThreshold.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={imageFilterThreshold}
          onChange={(event) => onImageFilterThresholdChange(Number(event.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Movement threshold: {movementThreshold.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={movementThreshold}
          onChange={(event) => onMovementThresholdChange(Number(event.target.value))}
        />
      </label>
    </div>
  );
};
