import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorldModel } from '../world/model';
import type { Lifecycle, Runtime, WorldCommand } from '../world/types';

export function useCityRuntime(model: WorldModel) {
  const [status, setStatus] = useState(() => model.snapshot());
  const [lifecycle, setLifecycle] = useState<Lifecycle>('loading');
  const [detail, setDetail] = useState('Preparing your little corner of the city.');
  const [attempt, setAttempt] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const publish = useCallback(() => setStatus(model.snapshot()), [model]);
  const send = useCallback((command: WorldCommand) => {
    if (runtime.current) runtime.current.command(command);
    else { model.command(command); publish(); }
  }, [model, publish]);

  useEffect(() => {
    if (!canvas.current) return;
    const element = canvas.current;
    let cancelled = false;
    let world: Runtime | undefined;
    const slow = window.setTimeout(() => {
      if (!cancelled && !world) setDetail('This is taking longer than usual. Hang tight while the live city loads.');
    }, 10000);
    void import('../world/createWorld').then(({ createWorld }) => {
      if (cancelled) return;
      world = createWorld({
        canvas: element, model, onChange: publish,
        onLifecycle(state, message) {
          if (!cancelled) { setLifecycle(state); setDetail(message); }
        },
      });
      runtime.current = world;
      clearTimeout(slow);
    }).catch((error: unknown) => {
      if (cancelled) return;
      clearTimeout(slow);
      const message = error instanceof Error ? error.message : 'The live city could not load. Try again.';
      setLifecycle(message.includes('WebGL2') ? 'unsupported' : 'error');
      setDetail(message);
    });
    return () => {
      cancelled = true;
      clearTimeout(slow);
      world?.dispose();
      runtime.current = null;
    };
  }, [attempt, model, publish]);

  function retry() {
    setLifecycle('loading');
    setDetail('Preparing the live city again.');
    setAttempt((value) => value + 1);
  }
  return { status, lifecycle, detail, attempt, canvas, send, retry };
}
