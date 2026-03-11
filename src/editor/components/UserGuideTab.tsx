export const UserGuideTab = () => {
  return (
    <div className="space-y-3 md:space-y-4">
      <section className="card border border-base-300 bg-base-200/60">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Quick Start</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-base-content/90">
            <li>Allow camera permission.</li>
            <li>Set mode to Edit and place zones on the canvas.</li>
            <li>Add sounds in Sound Library.</li>
            <li>Assign sounds to zones in Active Areas.</li>
            <li>Switch to Performance mode and move through zones.</li>
          </ol>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-200/60">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">How Controls Work</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/90">
            <li>Drag zones in Edit mode to reposition them.</li>
            <li>Use arrow keys to resize the last selected zone.</li>
            <li>Motion mode reacts to movement; Presence mode reacts to sustained occupancy.</li>
            <li>Overdub lets a zone retrigger while audio is still playing.</li>
            <li>Stop on leave stops zone audio after presence exits.</li>
          </ul>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-200/60">
        <div className="card-body gap-2.5 p-3 md:gap-3 md:p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">If Something Fails</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/90">
            <li>No camera: check browser camera permission and reselect input source.</li>
            <li>No sound: verify zone sound assignment and raise zone volume.</li>
            <li>Too many triggers: increase movement threshold.</li>
            <li>Missed triggers: lower movement threshold and improve lighting.</li>
            <li>Low FPS: lower process resolution and reduce active zones.</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
