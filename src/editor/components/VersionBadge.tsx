import { appVersionInfo } from '../../version';

export const VersionBadge = () => {
  return (
    <aside className="fixed bottom-3 right-3 rounded-md border border-emerald-200/20 bg-black/70 px-3 py-2 text-xs text-emerald-100 shadow-lg backdrop-blur">
      <div>
        <span className="text-emerald-300">v</span>
        {appVersionInfo.version}
      </div>
      <div className="opacity-90">commit {appVersionInfo.commit}</div>
      <div className="opacity-75">built {appVersionInfo.buildTimeLabel}</div>
    </aside>
  );
};
