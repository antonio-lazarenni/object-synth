import { useState } from 'react';
import { editorActions } from '../controller';
import { useEditorStore } from '../state';
import { ActiveAreasTab } from './ActiveAreasTab';
import { ModeToggle } from './ModeToggle';
import { SoundLibraryTab } from './SoundLibraryTab';
import { MODE } from '../types';

type TabId = 'active-areas' | 'sound-library';

export const ControlsTabs = () => {
  const [activeTab, setActiveTab] = useState<TabId>('active-areas');
  const mode = useEditorStore((state) => state.mode);
  const isPerformanceMode = mode === MODE.PERFORMANCE;

  return (
    <div className="card border border-base-300 bg-base-100/90 shadow-xl">
      <div className="card-body gap-4 p-3 md:p-4 lg:gap-5 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Control Dashboard</h2>
          <div className="flex items-center gap-2">
            <span className={`badge ${isPerformanceMode ? 'badge-warning' : 'badge-success'}`}>
              {isPerformanceMode ? 'Performance mode' : 'Edit mode'}
            </span>
            {isPerformanceMode ? <span className="badge badge-outline">Controls locked</span> : null}
          </div>
        </div>

        <ModeToggle mode={mode} onChange={editorActions.setMode} />

        <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1">
          <button
            role="tab"
            className={`tab h-10 flex-1 text-sm md:h-11 ${activeTab === 'active-areas' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('active-areas')}
            disabled={isPerformanceMode}
            type="button"
          >
            Active Areas
          </button>
          <button
            role="tab"
            className={`tab h-10 flex-1 text-sm md:h-11 ${activeTab === 'sound-library' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('sound-library')}
            disabled={isPerformanceMode}
            type="button"
          >
            Sound Library
          </button>
        </div>

        <fieldset disabled={isPerformanceMode} className={`space-y-3 md:space-y-4 ${isPerformanceMode ? 'opacity-60' : ''}`}>
          {activeTab === 'active-areas' ? <ActiveAreasTab /> : <SoundLibraryTab />}
        </fieldset>
      </div>
    </div>
  );
};
