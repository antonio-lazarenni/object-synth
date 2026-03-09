import { useEffect, useRef } from 'react';
import { mountEngine, unmountEngine } from '../controller';
import { ControlsTabs } from './ControlsTabs';

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
    <div className="grid min-h-screen gap-4 p-4 lg:grid-cols-[680px_1fr]">
      <section className="rounded-lg bg-black/40 p-2">
        <div ref={canvasHostRef} />
      </section>

      <section className="min-w-0">
        <ControlsTabs />
      </section>
    </div>
  );
};
