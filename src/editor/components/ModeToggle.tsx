import { MODE } from '../types';

type Props = {
  mode: MODE;
  onChange: (mode: MODE) => void;
};

export const ModeToggle = ({ mode, onChange }: Props) => {
  return (
    <div className="space-y-2">
      <div className="text-lg font-semibold">Mode</div>
      <div className="flex items-center gap-4">
        <label className="text-sm">
          <input
            className="mr-1"
            type="radio"
            checked={mode === MODE.EDIT}
            onChange={() => onChange(MODE.EDIT)}
          />
          Edit mode
        </label>
        <label className="text-sm">
          <input
            className="mr-1"
            type="radio"
            checked={mode === MODE.PERFORMANCE}
            onChange={() => onChange(MODE.PERFORMANCE)}
          />
          Performance mode
        </label>
      </div>
    </div>
  );
};
