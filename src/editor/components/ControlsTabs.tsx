import { useState } from 'react';
import { ActiveAreasTab } from './ActiveAreasTab';
import { SoundLibraryTab } from './SoundLibraryTab';

type TabId = 'active-areas' | 'sound-library';

export const ControlsTabs = () => {
  const [activeTab, setActiveTab] = useState<TabId>('active-areas');

  return (
    <div className="space-y-3 rounded-lg bg-emerald-900/40 p-3">
      <div className="flex gap-2">
        <button
          className={`rounded px-3 py-1 text-sm ${
            activeTab === 'active-areas' ? 'bg-emerald-700' : 'bg-emerald-950'
          }`}
          onClick={() => setActiveTab('active-areas')}
        >
          Active Areas
        </button>
        <button
          className={`rounded px-3 py-1 text-sm ${
            activeTab === 'sound-library' ? 'bg-emerald-700' : 'bg-emerald-950'
          }`}
          onClick={() => setActiveTab('sound-library')}
        >
          Sound Library
        </button>
      </div>

      {activeTab === 'active-areas' ? (
        <ActiveAreasTab />
      ) : (
        <SoundLibraryTab />
      )}
    </div>
  );
};
