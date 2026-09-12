import type { WorldCommand } from './types';

interface InputOptions {
  command: (command: WorldCommand) => void;
  select: (x: number, y: number) => void;
  enabled: () => boolean;
  scale: () => { x: number; y: number };
}

export function bindSceneInput(canvas: HTMLCanvasElement, options: InputOptions) {
  const pointers = new Map<number, { x: number; y: number }>();
  const listeners = new AbortController();
  const signal = listeners.signal;
  let origin = { x: 0, y: 0 };
  let previous = { x: 0, y: 0 };
  let multiStart = { span: 0, x: 0 };
  let multiPrevious = { span: 0, x: 0 };
  let multiMode: 'zoom' | 'rotate' | null = null;
  let multiMoves = 0;
  let dragged = false;
  let rotated = false;

  function release(id: number) {
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function clear() {
    for (const id of pointers.keys()) release(id);
    pointers.clear();
    dragged = false;
    multiMode = null;
    multiMoves = 0;
    delete canvas.dataset.dragging;
  }

  function measure() {
    const [a, b] = [...pointers.values()];
    return { span: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2 };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!options.enabled() || (event.button !== 0 && event.button !== 2) || pointers.size >= 2) return;
    event.preventDefault();
    canvas.parentElement?.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = 'true';
    if (pointers.size === 1) {
      origin = previous = { x: event.clientX, y: event.clientY };
      dragged = false;
      rotated = event.button === 2 || event.metaKey || event.ctrlKey;
    } else {
      multiStart = multiPrevious = measure();
      multiMode = null;
      multiMoves = 0;
      dragged = true;
    }
  }, { signal });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !options.enabled()) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const current = measure();
      multiMoves += 1;
      if (!multiMode) {
        // A paired touch move arrives as two pointer events; classify the pair.
        if (multiMoves < 2) return;
        if (Math.abs(current.span - multiStart.span) > 6) multiMode = 'zoom';
        else if (Math.abs(current.x - multiStart.x) > 8) multiMode = 'rotate';
        if (multiMode) multiPrevious = multiStart;
      }
      if (multiMode === 'zoom') options.command({ type: 'navigate', zoom: Math.log(Math.max(current.span, 1) / Math.max(multiPrevious.span, 1)) });
      if (multiMode === 'rotate') options.command({ type: 'navigate', rotate: -(current.x - multiPrevious.x) * 0.008 });
      multiPrevious = current;
    } else {
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) dragged = true;
      if (dragged) {
        const dx = event.clientX - previous.x;
        const dy = event.clientY - previous.y;
        const scale = options.scale();
        options.command(rotated
          ? { type: 'navigate', rotate: -dx * 0.008, tilt: dy * 0.006 }
          : { type: 'navigate', panX: -dx * scale.x, panZ: -dy * scale.y });
      }
      previous = { x: event.clientX, y: event.clientY };
    }
  }, { signal });

  canvas.addEventListener('pointerup', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const select = !dragged && !rotated && pointers.size === 1 && options.enabled();
    pointers.delete(event.pointerId);
    release(event.pointerId);
    if (pointers.size === 0) delete canvas.dataset.dragging;
    if (select) options.select(event.clientX, event.clientY);
    if (pointers.size === 1) {
      const [remaining] = pointers.values();
      previous = { ...remaining };
      dragged = true;
    }
  }, { signal });
  canvas.addEventListener('pointercancel', clear, { signal });
  canvas.addEventListener('lostpointercapture', (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) delete canvas.dataset.dragging;
  }, { signal });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  canvas.addEventListener('wheel', (event) => {
    if (!options.enabled()) return;
    event.preventDefault();
    const delta = Math.max(-120, Math.min(120, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1)));
    options.command(event.shiftKey ? { type: 'navigate', rotate: delta * 0.003 } : { type: 'navigate', zoom: -delta * 0.002 });
  }, { passive: false, signal });
  window.addEventListener('blur', clear, { signal });

  return {
    clear,
    dispose() {
      clear();
      listeners.abort();
    },
  };
}
