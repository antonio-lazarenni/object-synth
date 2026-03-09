import { MODE, ZONE_TYPE, type EditorState, type Zone } from './types';

type Listener = () => void;

const getInitialZones = (): Zone[] => {
  const saved = localStorage.getItem('object-synth-zones');
  if (saved) {
    try {
      return JSON.parse(saved) as Zone[];
    } catch {
      // fall through to defaults
    }
  }
  return [{ id: 0, x: 0, y: 0, w: 100, h: 100, type: ZONE_TYPE.DEFAULT }];
};

const initialState: EditorState = {
  mode: MODE.EDIT,
  zones: getInitialZones(),
  sounds: [],
  videoDevices: [],
  selectedVideoDeviceId: localStorage.getItem('selected-video-device-id'),
  processWidth: Number(localStorage.getItem('process-width') || '320'),
  processHeight: Number(localStorage.getItem('process-height') || '240'),
  showFpsDisplay: localStorage.getItem('show-fps') === 'true',
  imageFilterThreshold: Number(localStorage.getItem('image-filter-threshold') || '0.3'),
  movementThreshold: Number(localStorage.getItem('movement-threshold') || '0.02'),
  backgroundSoundId: null,
  backgroundVolume: Number(localStorage.getItem('background-sound-volume') || '0.5'),
};

class EditorStore {
  private state: EditorState = initialState;

  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): EditorState {
    return this.state;
  }

  setState(partial: Partial<EditorState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

export const editorStore = new EditorStore();
