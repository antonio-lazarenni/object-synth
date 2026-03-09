import type { EditorState } from '../types';
import { CameraSelector } from './CameraSelector';
import { ModeToggle } from './ModeToggle';
import { PerformanceControls } from './PerformanceControls';
import { ThresholdControls } from './ThresholdControls';
import { ZonesPanel } from './ZonesPanel';

type Props = {
  state: EditorState;
  actions: {
    setMode: (mode: EditorState['mode']) => void;
    setSelectedVideoDevice: (deviceId: string | null) => void;
    setProcessResolution: (w: number, h: number) => void;
    setShowFps: (show: boolean) => void;
    setActiveZoneCount: (count: number) => void;
    resetZones: () => void;
    setZoneSound: (index: number, soundId: string) => void;
    setZonePan: (index: number, pan: number) => void;
    setZoneVolume: (index: number, volume: number) => void;
    setImageFilterThreshold: (value: number) => void;
    setMovementThreshold: (value: number) => void;
  };
};

export const ActiveAreasTab = ({ state, actions }: Props) => {
  return (
    <div className="space-y-4">
      <ModeToggle mode={state.mode} onChange={actions.setMode} />
      <CameraSelector
        devices={state.videoDevices}
        selectedDeviceId={state.selectedVideoDeviceId}
        onChange={actions.setSelectedVideoDevice}
      />
      <PerformanceControls
        processWidth={state.processWidth}
        processHeight={state.processHeight}
        showFpsDisplay={state.showFpsDisplay}
        onChangeResolution={actions.setProcessResolution}
        onToggleFps={actions.setShowFps}
      />
      <ThresholdControls
        imageFilterThreshold={state.imageFilterThreshold}
        movementThreshold={state.movementThreshold}
        onImageFilterThresholdChange={actions.setImageFilterThreshold}
        onMovementThresholdChange={actions.setMovementThreshold}
      />
      <ZonesPanel
        zones={state.zones}
        sounds={state.sounds}
        onSetCount={actions.setActiveZoneCount}
        onResetZones={actions.resetZones}
        onSetZoneSound={actions.setZoneSound}
        onSetZonePan={actions.setZonePan}
        onSetZoneVolume={actions.setZoneVolume}
      />
    </div>
  );
};
