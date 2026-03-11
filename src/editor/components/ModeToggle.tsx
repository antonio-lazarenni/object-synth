import { MODE } from '../types';

type Props = {
  mode: MODE;
  onChange: (mode: MODE) => void;
};

export const ModeToggle = ({ mode, onChange }: Props) => {
  const isPerformance = mode === MODE.PERFORMANCE;

  return (
    <div className="card border border-base-300 bg-base-200/60">
      <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Mode</h3>
          <span className={`badge ${isPerformance ? 'badge-warning' : 'badge-success'}`}>
            {isPerformance ? 'Performance' : 'Edit'}
          </span>
        </div>
        <label className="label cursor-pointer justify-start gap-3 md:gap-4 py-1">
          <span className={`text-sm ${isPerformance ? 'text-base-content/60' : 'font-semibold'}`}>Edit</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm md:toggle-md"
            checked={isPerformance}
            onChange={(event) => onChange(event.target.checked ? MODE.PERFORMANCE : MODE.EDIT)}
          />
          <span className={`text-sm ${isPerformance ? 'font-semibold' : 'text-base-content/60'}`}>Performance</span>
        </label>
      </div>
    </div>
  );
};
