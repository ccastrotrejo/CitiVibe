import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { CAMERA_ACTIONS, CITY_ACTIONS, WORLD_ACTIONS, cameraCommand, cityCommand } from './commands';
import { SHORTCUTS } from './Help';
import type { WorldModel } from '../world/model';
import type { WorldCommand } from '../world/types';
import { bindSceneInput } from '../world/input';

const lifecycle = vi.hoisted(() => ({
  fail: false, model: null as WorldModel | null, command: vi.fn<(command: WorldCommand) => void>(),
}));
vi.mock('../world/createWorld', () => ({
  createWorld({ model, onChange, onLifecycle }: { model: WorldModel; onChange: () => void; onLifecycle: (state: string, message: string) => void }) {
    lifecycle.model = model;
    if (lifecycle.fail) throw new Error('WebGL2 is unavailable. Explore the static city.');
    onLifecycle('ready', 'Ready.');
    return {
      command(command: WorldCommand) { lifecycle.command(command); model.command(command); onChange(); },
      dispose: vi.fn(),
    };
  },
}));

/** Realistic `KeyboardEvent.key` values, including capitals, for every declared shortcut. */
const TYPED_KEYS: Record<string, string> = {
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
  '+': '+', '=': '=', '-': '-', q: 'Q', e: 'E', w: 'W', s: 'S', r: 'R', t: 'T', ' ': ' ',
};

/** Secondary keys documented through their primary equivalent. */
const DOCUMENTED_ALIASES: Record<string, string> = { '=': '+' };

function documentedKeys() {
  return new Set(SHORTCUTS.flatMap(([keys]) => keys.toLowerCase().split('/').map((entry) => entry.trim())));
}

beforeEach(() => {
  window.localStorage.clear();
  lifecycle.fail = false;
  lifecycle.command.mockClear();
  lifecycle.model = null;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

async function city() {
  render(<App />);
  await screen.findByText('City is living');
  const region = screen.getByRole('region', { name: 'City navigation' });
  region.focus();
  return {
    region,
    press(key: string) {
      lifecycle.command.mockClear();
      fireEvent.keyDown(region, { key });
      return lifecycle.command.mock.calls.map(([command]) => command);
    },
    click(name: string | RegExp) {
      lifecycle.command.mockClear();
      fireEvent.click(screen.getByRole('button', { name }));
      return lifecycle.command.mock.calls.map(([command]) => command);
    },
  };
}

describe('cross-input command parity', () => {
  it('declares one unique key set per action, each with a control and documentation', () => {
    const seen = new Set<string>();
    for (const action of WORLD_ACTIONS) {
      expect(action.keys.length, `${action.id} needs a shortcut`).toBeGreaterThan(0);
      for (const key of action.keys) {
        expect(seen.has(key), `${key} is bound twice`).toBe(false);
        seen.add(key);
        expect(TYPED_KEYS[key], `${key} needs a realistic key name in this test`).toBeTruthy();
        const documented = DOCUMENTED_ALIASES[key] ?? key;
        const label = documented.startsWith('arrow') ? 'arrow keys' : documented === ' ' ? 'space' : documented;
        expect(documentedKeys().has(label), `${key} is undocumented in keyboard help`).toBe(true);
      }
    }
  });

  it.each(CAMERA_ACTIONS.map((action) => [action.label, action] as const))(
    'dispatches the same %s command from its button and every shortcut', async (_label, action) => {
      const world = await city();
      const expected = cameraCommand(action);
      expect(world.click(action.label)).toEqual([expected]);
      for (const key of action.keys) expect(world.press(TYPED_KEYS[key])).toEqual([expected]);
    });

  it('toggles pause identically from the toolbar and Space', async () => {
    const world = await city();
    const keyPause = world.press(' ');
    const keyResume = world.press(' ');
    expect(world.click('Pause city')).toEqual(keyPause);
    expect(world.click('Resume city')).toEqual(keyResume);
    expect(keyPause).toEqual([cityCommand('pause', { paused: false, touring: false })]);
    expect(keyResume).toEqual([cityCommand('pause', { paused: true, touring: false })]);
  });

  it('toggles automatic views identically from the toolbar and T', async () => {
    const world = await city();
    const keyStart = world.press('T');
    const keyStop = world.press('T');
    expect(world.click('Start tour')).toEqual(keyStart);
    expect(world.click('Stop views')).toEqual(keyStop);
    expect(keyStart).toEqual([{ type: 'start-tour' }]);
    expect(keyStop).toEqual([{ type: 'stop' }]);
  });

  it('keeps reset available from both inputs on the static fallback and gates live-only actions', async () => {
    lifecycle.fail = true;
    render(<App />);
    await screen.findByText('Live city unavailable');
    const model = lifecycle.model;
    if (!model) throw new Error('The world model was never created.');
    const command = vi.spyOn(model, 'command');
    const region = screen.getByRole('region', { name: 'City navigation' });
    region.focus();

    fireEvent.keyDown(region, { key: 'R' });
    expect(command).toHaveBeenCalledWith(cameraCommand(CAMERA_ACTIONS.find((entry) => entry.id === 'reset')!));
    command.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reset overview' }));
    expect(command).toHaveBeenCalledWith({ type: 'reset' });

    command.mockClear();
    for (const action of WORLD_ACTIONS.filter((entry) => entry.requiresLive)) {
      for (const key of action.keys) fireEvent.keyDown(region, { key: TYPED_KEYS[key] });
      const button = screen.queryByRole('button', { name: action.label });
      if (button) expect(button).toBeDisabled();
    }
    expect(command).not.toHaveBeenCalled();
  });

  it('repeats held camera keys but not held pause or tour keys', async () => {
    const world = await city();
    lifecycle.command.mockClear();
    fireEvent.keyDown(world.region, { key: 'ArrowRight', repeat: true });
    expect(lifecycle.command).toHaveBeenCalledWith({ type: 'navigate', panX: 2 });
    lifecycle.command.mockClear();
    for (const action of CITY_ACTIONS) {
      for (const key of action.keys) fireEvent.keyDown(world.region, { key: TYPED_KEYS[key], repeat: true });
    }
    expect(lifecycle.command).not.toHaveBeenCalled();
  });
});

function gestures() {
  const region = document.createElement('div');
  region.tabIndex = 0;
  const canvas = document.createElement('canvas');
  region.append(canvas);
  document.body.append(region);
  const captured = new Set<number>();
  canvas.setPointerCapture = (id) => { captured.add(id); };
  canvas.hasPointerCapture = (id) => captured.has(id);
  canvas.releasePointerCapture = (id) => { captured.delete(id); };
  const command = vi.fn<(command: WorldCommand) => void>();
  const input = bindSceneInput(canvas, { command, enabled: () => true, scale: () => ({ x: 0.1, y: 0.14 }) });
  function pointer(type: string, id: number, x: number, y: number, button = 0, modifiers: Pick<MouseEventInit, 'metaKey'> = {}) {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button, cancelable: true, ...modifiers });
    Object.defineProperty(event, 'pointerId', { value: id });
    canvas.dispatchEvent(event);
  }
  return {
    pointer,
    wheel(deltaY: number, shiftKey = false) { canvas.dispatchEvent(new WheelEvent('wheel', { deltaY, shiftKey, cancelable: true })); },
    last() { return command.mock.calls.at(-1)?.[0] as Extract<WorldCommand, { type: 'navigate' }>; },
    dispose() { input.dispose(); region.remove(); },
  };
}

function axis(id: string, key: 'panX' | 'panZ' | 'rotate' | 'tilt' | 'zoom') {
  const command = cameraCommand(CAMERA_ACTIONS.find((entry) => entry.id === id)!);
  if (command.type !== 'navigate' || command[key] === undefined) throw new Error(`${id} has no ${key}`);
  return Math.sign(command[key]);
}

describe('pointer and touch gestures match the camera controls', () => {
  it('drags the scene along the same axes the pan buttons use', () => {
    const g = gestures();
    g.pointer('pointerdown', 1, 200, 200);
    g.pointer('pointermove', 1, 160, 160);
    const back = g.last();
    expect(back.type).toBe('navigate');
    expect(Math.sign(back.panX!)).toBe(axis('pan-right', 'panX'));
    expect(Math.sign(back.panZ!)).toBe(axis('pan-down', 'panZ'));
    g.pointer('pointermove', 1, 240, 240);
    const forward = g.last();
    expect(Math.sign(forward.panX!)).toBe(axis('pan-left', 'panX'));
    expect(Math.sign(forward.panZ!)).toBe(axis('pan-up', 'panZ'));
    expect(forward.rotate).toBeUndefined();
    expect(forward.zoom).toBeUndefined();
    g.dispose();
  });

  it('orbits with the same rotate and tilt directions as the orbit buttons', () => {
    const g = gestures();
    g.pointer('pointerdown', 1, 200, 200, 0, { metaKey: true });
    g.pointer('pointermove', 1, 240, 240);
    const right = g.last();
    expect(Math.sign(right.rotate!)).toBe(axis('rotate-left', 'rotate'));
    expect(Math.sign(right.tilt!)).toBe(axis('tilt-up', 'tilt'));
    g.pointer('pointermove', 1, 200, 200);
    const left = g.last();
    expect(Math.sign(left.rotate!)).toBe(axis('rotate-right', 'rotate'));
    expect(Math.sign(left.tilt!)).toBe(axis('tilt-down', 'tilt'));
    g.dispose();
  });

  it('zooms and rotates with the wheel in the button directions', () => {
    const g = gestures();
    g.wheel(-120);
    expect(Math.sign(g.last().zoom!)).toBe(axis('zoom-in', 'zoom'));
    g.wheel(120);
    expect(Math.sign(g.last().zoom!)).toBe(axis('zoom-out', 'zoom'));
    g.wheel(120, true);
    expect(Math.sign(g.last().rotate!)).toBe(axis('rotate-right', 'rotate'));
    g.wheel(-120, true);
    expect(Math.sign(g.last().rotate!)).toBe(axis('rotate-left', 'rotate'));
    g.dispose();
  });

  it('matches pinch and two-finger rotation to the zoom and rotate buttons', () => {
    const apart = gestures();
    apart.pointer('pointerdown', 1, 100, 100);
    apart.pointer('pointerdown', 2, 160, 100);
    apart.pointer('pointermove', 1, 80, 100);
    apart.pointer('pointermove', 2, 180, 100);
    expect(Math.sign(apart.last().zoom!)).toBe(axis('zoom-in', 'zoom'));
    apart.pointer('pointermove', 1, 110, 100);
    apart.pointer('pointermove', 2, 150, 100);
    expect(Math.sign(apart.last().zoom!)).toBe(axis('zoom-out', 'zoom'));
    apart.dispose();

    const sideways = gestures();
    sideways.pointer('pointerdown', 1, 100, 100);
    sideways.pointer('pointerdown', 2, 160, 100);
    sideways.pointer('pointermove', 1, 130, 100);
    sideways.pointer('pointermove', 2, 190, 100);
    expect(Math.sign(sideways.last().rotate!)).toBe(axis('rotate-left', 'rotate'));
    sideways.dispose();
  });
});
