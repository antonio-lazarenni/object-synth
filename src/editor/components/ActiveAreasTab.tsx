import { editorActions } from '../controller';
import { useEditorStore } from '../state';
import { CameraSelector } from './CameraSelector';
import { PerformanceControls } from './PerformanceControls';
import { ThresholdControls } from './ThresholdControls';
import { ZonesPanel } from './ZonesPanel';

export const ActiveAreasTab = () => {
  const videoDevices = useEditorStore((state) => state.videoDevices);
  const selectedVideoDeviceId = useEditorStore((state) => state.selectedVideoDeviceId);
  const processWidth = useEditorStore((state) => state.processWidth);
  const processHeight = useEditorStore((state) => state.processHeight);
  const showFpsDisplay = useEditorStore((state) => state.showFpsDisplay);
  const imageFilterThreshold = useEditorStore((state) => state.imageFilterThreshold);
  const movementThreshold = useEditorStore((state) => state.movementThreshold);
  const defaultDetectionMode = useEditorStore((state) => state.defaultDetectionMode);
  const zones = useEditorStore((state) => state.zones);
  const sounds = useEditorStore((state) => state.sounds);

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="grid gap-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
      </div>
      <ZonesPanel
        zones={zones}
        sounds={sounds}
        defaultDetectionMode={defaultDetectionMode}
        onSetCount={editorActions.setActiveZoneCount}
        onResetZones={editorActions.resetZones}
        onSetDefaultDetectionMode={editorActions.setDefaultDetectionMode}
        onSetZoneSound={editorActions.setZoneSound}
        onSetZonePan={editorActions.setZonePan}
        onSetZoneVolume={editorActions.setZoneVolume}
        onSetZoneOverdub={editorActions.setZoneOverdub}
        onSetZoneDetectionMode={editorActions.setZoneDetectionMode}
        onSetZoneStopOnLeave={editorActions.setZoneStopOnLeave}
      />
    </div>
  );
};
