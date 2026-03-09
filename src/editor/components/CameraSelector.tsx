type Props = {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  onChange: (deviceId: string | null) => void;
};

export const CameraSelector = ({ devices, selectedDeviceId, onChange }: Props) => {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Webcam
      <select
        className="rounded border border-emerald-900 bg-emerald-950 px-2 py-1"
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
  );
};
