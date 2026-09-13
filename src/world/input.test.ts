import { describe, expect, it, vi } from 'vitest';
import { bindSceneInput } from './input';

function fixture() {
  const region = document.createElement('div');
  region.tabIndex = 0;
  const canvas = document.createElement('canvas');
  region.append(canvas);
  document.body.append(region);
  const captured = new Set<number>();
  canvas.setPointerCapture = (id) => { captured.add(id); };
  canvas.hasPointerCapture = (id) => captured.has(id);
  canvas.releasePointerCapture = (id) => { captured.delete(id); };
  const command = vi.fn();
  let enabled = true;
  const input = bindSceneInput(canvas, { command, enabled: () => enabled, scale: () => ({ x: 0.1, y: 0.14 }) });
  function pointer(type: string, id: number, x: number, y: number, button = 0, modifiers: Pick<MouseEventInit, 'metaKey' | 'ctrlKey'> = {}) {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button, cancelable: true, ...modifiers });
    Object.defineProperty(event, 'pointerId', { value: id });
    canvas.dispatchEvent(event);
    return event;
  }
  return {
    canvas, region, command, captured, pointer,
    disable() { enabled = false; },
    dispose() { input.dispose(); region.remove(); },
  };
}

describe('scene-only gesture routing', () => {
  it.each([{ metaKey: true }, { ctrlKey: true }])('orbits horizontally and vertically with modifier %j, even if released mid-drag', (modifiers) => {
    const f = fixture();
    const down = f.pointer('pointerdown', 1, 100, 100, 0, modifiers);
    f.pointer('pointermove', 1, 125, 150);
    f.pointer('pointerup', 1, 125, 150);
    expect(f.command).toHaveBeenLastCalledWith({ type: 'navigate', rotate: -0.2, tilt: 0.3 });
    expect(down.defaultPrevented).toBe(true);
    expect(f.command).toHaveBeenCalledTimes(1);
    expect(f.captured.size).toBe(0);
    expect(f.canvas.dataset.dragging).toBeUndefined();
    f.dispose();
  });

  it('uses the same orbit for right-drag and ignores a modified click', () => {
    const f = fixture();
    f.pointer('pointerdown', 1, 100, 100, 2);
    f.pointer('pointermove', 1, 125, 150, 2);
    f.pointer('pointerup', 1, 125, 150, 2);
    expect(f.command).toHaveBeenLastCalledWith({ type: 'navigate', rotate: -0.2, tilt: 0.3 });
    f.pointer('pointerdown', 2, 100, 100, 0, { metaKey: true });
    f.pointer('pointerup', 2, 100, 100);
    expect(f.command).toHaveBeenCalledTimes(1);
    f.dispose();
  });

  it('scales both pan axes to the projection and clears the grab cursor on cancellation', () => {
    const f = fixture();
    f.pointer('pointerdown', 1, 100, 100);
    expect(f.canvas.dataset.dragging).toBe('true');
    f.pointer('pointermove', 1, 120, 150);
    expect(f.command).toHaveBeenLastCalledWith({ type: 'navigate', panX: -2, panZ: expect.closeTo(-7) });
    f.pointer('pointercancel', 1, 120, 150);
    expect(f.canvas.dataset.dragging).toBeUndefined();
    f.dispose();
  });

  it('focuses the region without issuing a command on click, while drag still pans and releases capture', () => {
    const f = fixture();
    f.pointer('pointerdown', 1, 10, 10);
    f.pointer('pointerup', 1, 10, 10);
    expect(f.command).not.toHaveBeenCalled();
    f.pointer('pointerdown', 2, 10, 10);
    f.pointer('pointermove', 2, 30, 10);
    f.pointer('pointerup', 2, 30, 10);
    expect(f.command).toHaveBeenCalledWith({ type: 'navigate', panX: -2, panZ: -0 });
    expect(f.command).toHaveBeenCalledTimes(1);
    expect(f.captured.size).toBe(0);
    expect(document.activeElement).toBe(f.region);
    f.dispose();
  });

  it('locks a paired two-finger sideways movement to rotation, not a transient pinch', () => {
    const f = fixture();
    f.pointer('pointerdown', 1, 10, 10);
    f.pointer('pointerdown', 2, 70, 10);
    f.pointer('pointermove', 1, 30, 10);
    expect(f.command).not.toHaveBeenCalled();
    f.pointer('pointermove', 2, 90, 10);
    expect(f.command).toHaveBeenLastCalledWith({ type: 'navigate', rotate: -0.16 });
    f.pointer('pointermove', 2, 130, 10);
    expect(f.command.mock.calls.every(([command]) => command.rotate !== undefined)).toBe(true);
    f.dispose();
  });

  it('locks pinch to zoom and clears all gestures on blur or cancellation', () => {
    const f = fixture();
    f.pointer('pointerdown', 1, 10, 10);
    f.pointer('pointerdown', 2, 70, 10);
    f.pointer('pointermove', 1, 0, 10);
    f.pointer('pointermove', 2, 80, 10);
    expect(f.command).toHaveBeenLastCalledWith({ type: 'navigate', zoom: Math.log(80 / 60) });
    window.dispatchEvent(new Event('blur'));
    expect(f.captured.size).toBe(0);
    const count = f.command.mock.calls.length;
    f.pointer('pointermove', 1, 50, 10);
    expect(f.command).toHaveBeenCalledTimes(count);
    f.pointer('pointerdown', 3, 20, 20);
    f.pointer('pointercancel', 3, 20, 20);
    expect(f.captured.size).toBe(0);
    f.dispose();
  });

  it('ignores disabled scene input and removes wheel/pointer listeners on disposal', () => {
    const f = fixture();
    f.disable();
    f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 20 }));
    f.pointer('pointerdown', 1, 10, 10);
    expect(f.command).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
    f.dispose();
    f.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 20 }));
    expect(f.command).not.toHaveBeenCalled();
  });
});
