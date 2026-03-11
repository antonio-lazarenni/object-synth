type Props = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  onChange: (deviceId: string | null) => void;
};

export const CameraSelector = ({ devices, selectedDeviceId, onChange }: Props) => {
  return (
    <div className="card border border-base-300 bg-base-200/60">
      <div className="card-body gap-2 p-3 md:p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Input Source</h3>
        <label className="form-control w-full">
          <span className="label-text mb-1">Webcam</span>
          <select
            className="select select-bordered select-sm md:select-md w-full"
            value={selectedDeviceId ?? ''}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">Default camera</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};
