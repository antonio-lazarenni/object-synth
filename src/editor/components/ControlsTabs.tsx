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
    <div className="space-y-3 rounded-lg bg-emerald-900/40 p-3">
      <ModeToggle mode={mode} onChange={editorActions.setMode} />
      <div className="flex gap-2">
        <button
          className={`rounded px-3 py-1 text-sm ${
            activeTab === 'active-areas' ? 'bg-emerald-700' : 'bg-emerald-950'
          } ${isPerformanceMode ? 'cursor-not-allowed opacity-60' : ''}`}
          onClick={() => setActiveTab('active-areas')}
          disabled={isPerformanceMode}
          type="button"
        >
          Active Areas
        </button>
        <button
          className={`rounded px-3 py-1 text-sm ${
            activeTab === 'sound-library' ? 'bg-emerald-700' : 'bg-emerald-950'
          } ${isPerformanceMode ? 'cursor-not-allowed opacity-60' : ''}`}
          onClick={() => setActiveTab('sound-library')}
          disabled={isPerformanceMode}
          type="button"
        >
          Sound Library
        </button>
      </div>

      <fieldset disabled={isPerformanceMode} className={isPerformanceMode ? 'opacity-60' : ''}>
        {activeTab === 'active-areas' ? <ActiveAreasTab /> : <SoundLibraryTab />}
      </fieldset>
    </div>
  );
};
