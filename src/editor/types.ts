export enum MODE {
  EDIT = 'edit',
  PERFORMANCE = 'performance',
}

export enum ZONE_TYPE {
  DEFAULT = 'default',
  MIDI = 'midi',
  SOUND = 'sound',
}

export type DetectionMode = 'motion' | 'presence';

export interface SoundFile {
  id: string;
  name: string;
  type: string;
  data: Blob | ArrayBuffer;
  url?: string;
}

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  id: number;
  type: ZONE_TYPE;
  soundId?: string;
  pan?: number;
  volume?: number;
  overdub?: boolean;
  detectionMode?: DetectionMode;
  stopOnLeave?: boolean;
}

export interface ProcessResolution {
  w: number;
  h: number;
  label: string;
}

export const PROCESS_RESOLUTIONS: ProcessResolution[] = [
  { w: 640, h: 480, label: '640x480 (full)' },
  { w: 320, h: 240, label: '320x240 (2x faster)' },
  { w: 160, h: 120, label: '160x120 (4x faster)' },
];

export interface EditorState {
  mode: MODE;
  zones: Zone[];
  sounds: SoundFile[];
  videoDevices: MediaDeviceInfo[];
  selectedVideoDeviceId: string | null;
  processWidth: number;
  processHeight: number;
  showFpsDisplay: boolean;
  imageFilterThreshold: number;
  movementThreshold: number;
  defaultDetectionMode: DetectionMode;
  backgroundSoundId: string | null;
  backgroundVolume: number;
}
