import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { MODE, ZONE_TYPE, type DetectionMode, type EditorState, type Zone } from './types';

const readStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
};

const getInitialDefaultDetectionMode = (): DetectionMode => {
  const saved = readStorage('default-detection-mode');
  return saved === 'presence' ? 'presence' : 'motion';
};

const getInitialZones = (): Zone[] => {
  const saved = readStorage('object-synth-zones');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Zone[];
      return parsed.map((zone) => ({
        ...zone,
        overdub: zone.overdub ?? true,
        stopOnLeave: zone.stopOnLeave ?? false,
      }));
    } catch {
      // fall through to defaults
    }
  }
  return [
    {
      id: 0,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      type: ZONE_TYPE.DEFAULT,
      overdub: true,
      stopOnLeave: false,
    },
  ];
};

const createInitialState = (): EditorState => ({
  mode: MODE.EDIT,
  zones: getInitialZones(),
  sounds: [],
  videoDevices: [],
  selectedVideoDeviceId: readStorage('selected-video-device-id'),
  processWidth: Number(readStorage('process-width') || '320'),
  processHeight: Number(readStorage('process-height') || '240'),
  showFpsDisplay: readStorage('show-fps') === 'true',
  imageFilterThreshold: Number(readStorage('image-filter-threshold') || '0.3'),
  movementThreshold: Number(readStorage('movement-threshold') || '0.02'),
  defaultDetectionMode: getInitialDefaultDetectionMode(),
  backgroundSoundId: null,
  backgroundVolume: Number(readStorage('background-sound-volume') || '0.5'),
});

export const editorStore = createStore<EditorState>(() => createInitialState());

export const setEditorStatePartial = (partial: Partial<EditorState>): void => {
  editorStore.setState(partial);
};

export const useEditorStore = <T>(selector: (state: EditorState) => T): T =>
  useStore(editorStore, selector);
