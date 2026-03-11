import { appVersionInfo } from '../../version';

export const VersionBadge = () => {
  return (
    <aside className="fixed bottom-2 right-2 rounded-box border border-base-300 bg-base-100/90 px-2.5 py-1.5 text-[11px] text-base-content shadow-lg backdrop-blur md:bottom-3 md:right-3 md:px-3 md:py-2 md:text-xs">
      <div className="font-medium">
        <span className="text-primary">v</span>
        {appVersionInfo.version}
      </div>
      <div className="text-base-content/85">commit {appVersionInfo.commit}</div>
      <div className="text-base-content/65">built {appVersionInfo.buildTimeLabel}</div>
    </aside>
  );
};
