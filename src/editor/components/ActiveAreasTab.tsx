import { editorActions } from '../controller';
import { useEditorStore } from '../state';
import { CameraSelector } from './CameraSelector';
import { ModeToggle } from './ModeToggle';
import { PerformanceControls } from './PerformanceControls';
import { ThresholdControls } from './ThresholdControls';
import { ZonesPanel } from './ZonesPanel';

export const ActiveAreasTab = () => {
  const mode = useEditorStore((state) => state.mode);
  const videoDevices = useEditorStore((state) => state.videoDevices);
  const selectedVideoDeviceId = useEditorStore((state) => state.selectedVideoDeviceId);
  const processWidth = useEditorStore((state) => state.processWidth);
  const processHeight = useEditorStore((state) => state.processHeight);
  const showFpsDisplay = useEditorStore((state) => state.showFpsDisplay);
  const imageFilterThreshold = useEditorStore((state) => state.imageFilterThreshold);
  const movementThreshold = useEditorStore((state) => state.movementThreshold);
  const zones = useEditorStore((state) => state.zones);
  const sounds = useEditorStore((state) => state.sounds);

  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} onChange={editorActions.setMode} />
      <CameraSelector
        devices={videoDevices}
        selectedDeviceId={selectedVideoDeviceId}
        onChange={editorActions.setSelectedVideoDevice}
      />
      <PerformanceControls
        processWidth={processWidth}
        processHeight={processHeight}
        showFpsDisplay={showFpsDisplay}
        onChangeResolution={editorActions.setProcessResolution}
        onToggleFps={editorActions.setShowFps}
      />
      <ThresholdControls
        imageFilterThreshold={imageFilterThreshold}
        movementThreshold={movementThreshold}
        onImageFilterThresholdChange={editorActions.setImageFilterThreshold}
        onMovementThresholdChange={editorActions.setMovementThreshold}
      />
      <ZonesPanel
        zones={zones}
        sounds={sounds}
        onSetCount={editorActions.setActiveZoneCount}
        onResetZones={editorActions.resetZones}
        onSetZoneSound={editorActions.setZoneSound}
        onSetZonePan={editorActions.setZonePan}
        onSetZoneVolume={editorActions.setZoneVolume}
      />
    </div>
  );
};
