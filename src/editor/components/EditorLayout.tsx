import { useEffect, useRef } from 'react';
import { editorActions, mountEngine, unmountEngine, useEditorState } from '../controller';
import { ControlsTabs } from './ControlsTabs';

export const EditorLayout = () => {
  const state = useEditorState();
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
        <ControlsTabs state={state} actions={editorActions} />
      </section>
    </div>
  );
};
