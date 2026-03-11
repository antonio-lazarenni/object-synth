import { useEffect, useRef } from 'react';
import { mountEngine, unmountEngine } from '../controller';
import { ControlsTabs } from './ControlsTabs';
import { VersionBadge } from './VersionBadge';

export const EditorLayout = () => {
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    mountEngine(host);
    return () => {
      unmountEngine();
    };
  }, []);

  return (
    <div className="min-h-screen bg-base-200 p-3 md:p-4 lg:p-5">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:gap-5 lg:grid-cols-[minmax(600px,1.22fr)_minmax(360px,1fr)] xl:grid-cols-[minmax(660px,1.3fr)_minmax(420px,1fr)]">
        <section className="card border border-base-300 bg-base-100/70 shadow-xl backdrop-blur">
          <div className="card-body p-2.5 md:p-3 lg:p-4">
            <div className="rounded-xl bg-black/35 p-2">
              <div ref={canvasHostRef} />
            </div>
          </div>
        </section>
        <section className="min-w-0">
          <ControlsTabs />
        </section>
      </div>
      <VersionBadge />
    </div>
  );
};
