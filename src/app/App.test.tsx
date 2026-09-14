import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { CAMERA_ANCHORS } from '../content/city';
import { DEFAULT_PREFERENCES, loadPreferences, PREFERENCE_KEY, WEATHER_LABELS } from '../content/preferences';
import type { WorldModel } from '../world/model';
import type { WorldCommand } from '../world/types';

const lifecycle = vi.hoisted(() => ({
  fail: false, dispose: vi.fn(), model: null as WorldModel | null, publish: null as (() => void) | null,
  command: vi.fn<(command: WorldCommand) => void>(),
}));
vi.mock('../world/createWorld', () => ({
  createWorld({ model, onChange, onLifecycle }: { model: WorldModel; onChange: () => void; onLifecycle: (state: string, message: string) => void }) {
    lifecycle.model = model;
    if (lifecycle.fail) throw new Error('WebGL2 is unavailable. Explore the static city.');
    lifecycle.publish = onChange;
    onLifecycle('ready', 'Ready.');
    return {
      command(command: WorldCommand) { lifecycle.command(command); model.command(command); onChange(); },
      dispose: lifecycle.dispose,
    };
  },
}));

beforeEach(() => {
  window.localStorage.clear();
  lifecycle.fail = false;
  lifecycle.dispose.mockClear();
  lifecycle.command.mockClear();
  lifecycle.model = null;
  lifecycle.publish = null;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLButtonElement>('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('accessible city controls', () => {
  it('keeps an accessible page heading without covering the city with a title card', async () => {
    render(<App />);
    await screen.findByText('City is living');
    expect(screen.getByRole('heading', { level: 1, name: 'Rainlight Square' })).toHaveClass('sr-only');
    expect(screen.queryByText('The park district / 003')).not.toBeInTheDocument();
    expect(screen.queryByText('A green heart. A living neighborhood.')).not.toBeInTheDocument();
    expect(document.querySelector('.scene-heading')).toBeNull();
    expect(document.querySelector('.wordmark')).toHaveTextContent('CitiVibe.');
    expect(screen.queryByRole('button', { name: 'Field guide' })).not.toBeInTheDocument();
  });

  it('connects pause, the city-wide tour and manual interruption without landmark or follow controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    expect(screen.getByText('Tour view')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('Free view')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause city' }));
    await user.click(screen.getByRole('button', { name: 'Reset overview' }));
    expect(screen.getByText('Overview')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pan right' }));
    expect(screen.getByText('Free view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  });

  it('scopes shortcuts to the navigation region, not buttons', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    screen.getByRole('button', { name: 'Zoom in' }).focus();
    await user.keyboard('q');
    expect(lifecycle.command).not.toHaveBeenCalled();
    screen.getByRole('region', { name: 'City navigation' }).focus();
    await user.keyboard('bd');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    await user.keyboard('t');
    expect(screen.getByText('Tour view')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Free view')).toBeInTheDocument();
  });

  it('keeps repeated camera controls static and retains both pause icons across state changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    const camera = screen.getByRole('group', { name: 'Camera navigation' });
    for (const button of within(camera).getAllByRole('button')) {
      expect(button).toHaveAttribute('data-static', 'true');
      expect(button.querySelector('.icon-state')).toBeNull();
    }
    const pause = screen.getByRole('button', { name: 'Pause city' });
    const icons = Array.from(pause.querySelectorAll('.icon-state'));
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveClass('is-visible');
    expect(icons[1]).not.toHaveClass('is-visible');
    await user.click(pause);
    expect(screen.getByRole('button', { name: 'Resume city' })).toBe(pause);
    expect(pause.querySelectorAll('.icon-state')[0]).toBe(icons[0]);
    expect(pause.querySelectorAll('.icon-state')[1]).toBe(icons[1]);
    expect(icons[0]).not.toHaveClass('is-visible');
    expect(icons[1]).toHaveClass('is-visible');
    await user.click(pause);
    expect(icons[0]).toHaveClass('is-visible');
    expect(icons[1]).not.toHaveClass('is-visible');
  });

  it('restores help focus without resuming camera movement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    const trigger = screen.getByRole('region', { name: 'City navigation' });
    trigger.focus();
    await user.keyboard('?');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(trigger).toHaveFocus();
    expect(screen.getByText('Free view')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
  });

  it('keeps discoverable keyboard help in Settings without a header helper', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    const settings = screen.getByRole('button', { name: 'Settings' });
    await user.click(settings);
    const summary = screen.getByText('Keyboard shortcuts', { exact: true });
    await user.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Pan around the square')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(settings).toHaveFocus();
  });

  it('retains the descriptive static city and retries without landmark navigation', async () => {
    lifecycle.fail = true;
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/WebGL2 is unavailable/);
    expect(screen.getByRole('button', { name: 'Pause city' })).toBeDisabled();
    expect(screen.getByRole('img', { name: /Original miniature city/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start tour' })).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'Landmark navigation' })).not.toBeInTheDocument();
    const retained = lifecycle.model;
    lifecycle.fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry live city' }));
    await screen.findByText('City is living');
    expect(lifecycle.model).toBe(retained);
    expect(screen.getByRole('button', { name: 'Start tour' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Next landmark' })).not.toBeInTheDocument();
  });

  it('disposes the live world on unmount', async () => {
    const { unmount } = render(<App />);
    await screen.findByText('City is living');
    unmount();
    await waitFor(() => expect(lifecycle.dispose).toHaveBeenCalledTimes(1));
  });

  it('stops a tour when settings opens and saves a reduced-motion preference', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    expect(screen.getByText('Tour view')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Settings' });
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(lifecycle.model?.modalOpen).toBe(false);
    expect(screen.getByText('Free view')).toBeInTheDocument();
    await user.click(screen.getByText('More controls'));
    await user.selectOptions(screen.getByLabelText('Motion'), 'reduced');
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(trigger).toHaveFocus();
    expect(screen.getByText('Free view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume city' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Guided views' }));
    await user.click(screen.getByRole('button', { name: 'Next view' }));
    expect(screen.getByText(`Guided view 2 / ${CAMERA_ANCHORS.length}`, { exact: false })).toBeInTheDocument();
    expect(window.localStorage.getItem('livingcity.preferences')).toContain('"motion":"reduced"');
  });

  it('keeps the six weather choices in a labeled native select with a fictional-weather explanation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    expect(screen.getByText(/Afternoon.*Sunny/)).toHaveTextContent('Afternoon / Sunny');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('region', { name: 'City settings' })).toBeInTheDocument();
    const weather = screen.getByRole('combobox', { name: 'Weather' });
    expect(weather.tagName).toBe('SELECT');
    expect(weather).toHaveValue('sunny');
    expect(within(weather).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Sunny', 'Cloudy', 'Rain', 'Mist', 'Snow', 'Windy']);
    expect(weather).toHaveAccessibleDescription(/Fictional weather, not live data.*Rain falls, snow settles and wind moves foliage.*wetness and snow clear gradually/);
    weather.focus();
    expect(weather).toHaveFocus();
    expect(screen.getByRole('checkbox', { name: 'Let the weather drift on its own' })).not.toBeChecked();
  });

  it('dispatches, saves and restores rain intensity including zero', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ ...DEFAULT_PREFERENCES, weather: 'rain' }));
    const user = userEvent.setup();
    const firstVisit = render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const intensity = screen.getByRole('slider', { name: 'Rain intensity' });
    expect(intensity).toHaveAttribute('min', '0');
    expect(intensity).toHaveAttribute('max', '30');
    expect(intensity).toHaveAttribute('step', '1');
    expect(intensity).toHaveValue('8');
    expect(intensity).toHaveAccessibleDescription(/Fictional rain rate, applied only during rain/);
    expect(screen.getByText('8 mm/h')).toHaveAttribute('for', intensity.id);
    for (const value of [30, 0]) {
      fireEvent.change(intensity, { target: { value: String(value) } });
      expect(lifecycle.command).toHaveBeenLastCalledWith({ type: 'set-rain-intensity', millimetersPerHour: value });
      expect(lifecycle.model?.snapshot()).toMatchObject({ weather: 'rain', rainIntensityMmH: value });
      expect(loadPreferences().value.rainIntensityMmH).toBe(value);
      expect(intensity).toHaveAttribute('aria-valuetext', `${value} millimeters per hour`);
      expect(screen.getByText(`${value} mm/h`)).toBeInTheDocument();
    }
    firstVisit.unmount();
    render(<App />);
    await screen.findByText('City is living');
    expect(lifecycle.model?.snapshot()).toMatchObject({ weather: 'rain', rainIntensityMmH: 0 });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('slider', { name: 'Rain intensity' })).toHaveValue('0');
  });

  it('shows intensity only for Rain or natural weather without changing another preset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const weather = screen.getByRole('combobox', { name: 'Weather' });
    for (const mode of ['sunny', 'cloudy', 'mist', 'snow', 'windy'] as const) {
      await user.selectOptions(weather, mode);
      expect(screen.queryByRole('slider', { name: 'Rain intensity' })).not.toBeInTheDocument();
    }
    expect(lifecycle.command.mock.calls.some(([command]) => command.type === 'set-rain-intensity')).toBe(false);
    await user.click(screen.getByRole('checkbox', { name: 'Let the weather drift on its own' }));
    const intensity = screen.getByRole('slider', { name: 'Rain intensity' });
    fireEvent.change(intensity, { target: { value: '14' } });
    expect(lifecycle.model?.snapshot()).toMatchObject({ weather: 'windy', natural: true, rainIntensityMmH: 14 });
    expect(loadPreferences().value).toMatchObject({ weather: 'windy', natural: true, rainIntensityMmH: 14 });
    await user.click(screen.getByRole('checkbox', { name: 'Let the weather drift on its own' }));
    expect(screen.queryByRole('slider', { name: 'Rain intensity' })).not.toBeInTheDocument();
    await user.selectOptions(weather, 'rain');
    expect(screen.getByRole('slider', { name: 'Rain intensity' })).toHaveValue('14');
    await user.selectOptions(weather, 'snow');
    expect(screen.queryByRole('slider', { name: 'Rain intensity' })).not.toBeInTheDocument();
    expect(lifecycle.command.mock.calls.filter(([command]) => command.type === 'set-rain-intensity')).toHaveLength(1);
  });

  it('publishes rain intensity without silently changing the saved slider choice', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ ...DEFAULT_PREFERENCES, weather: 'rain', natural: true }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    act(() => {
      lifecycle.model!.environment.setRainIntensity(19);
      lifecycle.publish!();
    });
    expect(screen.getByRole('slider', { name: 'Rain intensity' })).toHaveValue('8');
    expect(loadPreferences().value.rainIntensityMmH).toBe(8);
  });

  it('shows the existing invalid-settings notice for an out-of-range saved rain intensity', async () => {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ ...DEFAULT_PREFERENCES, rainIntensityMmH: 31 }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    expect(screen.getByText(/Saved settings are invalid/)).toBeInTheDocument();
    expect(lifecycle.model?.snapshot().rainIntensityMmH).toBe(8);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText(/Saved settings are invalid/)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Weather' }), 'rain');
    expect(screen.getByRole('slider', { name: 'Rain intensity' })).toHaveValue('8');
  });

  it('keeps one standalone in-city Settings trigger while toggling the dock and restoring focus on close or Escape', async () => {
    const user = userEvent.setup();
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<App />);
    await screen.findByText('City is living');
    const trigger = screen.getByRole('button', { name: 'Settings' });
    const anchor = trigger.closest('.settings-anchor');
    expect(anchor).not.toBeNull();
    expect(trigger.closest('.scene-shell')).not.toBeNull();
    expect(trigger.closest('.control-bar')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'City controls' })).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1);
    expect(trigger).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'City settings' })).not.toBeInTheDocument();
    expect(screen.queryByText('Around the square')).not.toBeInTheDocument();
    await user.click(trigger);
    const dock = screen.getByRole('region', { name: 'City settings' });
    expect(anchor).toContainElement(dock);
    expect(dock.nextElementSibling).toBe(trigger);
    expect(screen.getAllByRole('button', { name: 'Settings' })).toHaveLength(1);
    expect(trigger).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dock.id);
    expect(dock.closest('.scene-bottom')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'City navigation' })).not.toContainElement(dock);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(showModal).not.toHaveBeenCalled();
    expect(lifecycle.model?.modalOpen).toBe(false);
    expect(screen.getByRole('button', { name: 'Close settings' })).toHaveFocus();
    await user.click(trigger);
    expect(screen.queryByRole('region', { name: 'City settings' })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(trigger).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    const pose = { ...lifecycle.model!.camera.pose };
    await user.click(trigger);
    screen.getByRole('combobox', { name: 'Weather' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'City settings' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(lifecycle.model?.camera.pose).toEqual(pose);
    expect(lifecycle.command).not.toHaveBeenCalledWith({ type: 'open-panel' });
    expect(lifecycle.command).not.toHaveBeenCalledWith({ type: 'close-panel' });
  });

  it('does not trap Tab or reclaim focus after leaving settings for ordinary city interaction', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dock = screen.getByRole('region', { name: 'City settings' });
    await user.tab({ shift: true });
    expect(dock).not.toContainElement(document.activeElement as HTMLElement);
    await user.click(screen.getByText('More controls'));
    screen.getByRole('checkbox', { name: 'Show navigation hint' }).focus();
    await user.tab();
    expect(screen.getByText('Keyboard shortcuts', { exact: true })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Pan up' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveFocus();
    expect(dock).toBeInTheDocument();
    expect(lifecycle.model?.modalOpen).toBe(false);
  });

  it('stops an existing tour only on opening settings while keeping keyboard, camera and pause controls live', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    lifecycle.command.mockClear();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(lifecycle.command.mock.calls).toEqual([[{ type: 'stop' }]]);
    const navigation = screen.getByRole('region', { name: 'City navigation' });
    await user.click(navigation);
    await user.keyboard('{ArrowRight}q');
    expect(lifecycle.command).toHaveBeenCalledWith({ type: 'navigate', panX: 2 });
    expect(lifecycle.command).toHaveBeenCalledWith({ type: 'navigate', rotate: -0.2 });
    expect(navigation).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Resume city' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Resume city' }));
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(lifecycle.command).toHaveBeenCalledWith({ type: 'navigate', zoom: 0.15 });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Weather' }), 'snow');
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    expect(screen.getByText('Tour view')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.getByText('Tour view')).toBeInTheDocument();
    expect(lifecycle.command.mock.calls.filter(([command]) => command.type === 'stop')).toHaveLength(1);
    expect(lifecycle.model?.modalOpen).toBe(false);
  });

  it('switches settings to real modal Help through its shortcut without a focus race', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const returnTarget = screen.getByRole('region', { name: 'City navigation' });
    await user.click(returnTarget);
    await user.keyboard('?');
    expect(screen.queryByRole('region', { name: 'City settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: 'City controls' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close help' })).toHaveFocus();
    expect(lifecycle.model?.modalOpen).toBe(true);
    expect(lifecycle.command).toHaveBeenLastCalledWith({ type: 'open-panel' });
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(lifecycle.command).toHaveBeenLastCalledWith({ type: 'close-panel' });
    expect(lifecycle.model?.modalOpen).toBe(false);
    expect(returnTarget).toHaveFocus();
    expect(screen.queryByRole('region', { name: 'City settings' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Close settings' })).toHaveFocus();
  });

  it.each([false, true])('removes landmark controls and leaves former bracket shortcuts inert with renderer failure=%s', async (failed) => {
    lifecycle.fail = failed;
    const user = userEvent.setup();
    render(<App />);
    if (failed) await screen.findByText(/WebGL2 is unavailable/);
    else await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('group', { name: 'Landmark navigation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Find a quiet place')).not.toBeInTheDocument();
    for (const name of ['Next landmark', 'Previous landmark', 'Clear selection', 'Tour this landmark']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(document.querySelector('.landmark-description, .static-marker')).toBeNull();
    expect(screen.getByRole('region', { name: 'City settings' })).toBeInTheDocument();
    const navigation = screen.getByRole('region', { name: 'City navigation' });
    navigation.focus();
    expect(navigation).not.toHaveAccessibleDescription(/landmark|bracket/i);
    const before = lifecycle.model!.snapshot();
    lifecycle.command.mockClear();
    for (const key of ['[', ']']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      act(() => { navigation.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(lifecycle.command).not.toHaveBeenCalled();
    expect(lifecycle.model!.snapshot()).toEqual(before);
    await user.keyboard('?');
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/landmark|clear selection|\[ \/ \]/i);
  });

  it('keeps time and expandable motion, quality and hint preferences functional with night contrast intact', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time of day' }), 'night');
    expect(screen.getByRole('region', { name: 'City navigation' }).closest('.scene-shell')).toHaveAttribute('data-night', 'true');
    await user.click(screen.getByText('More controls'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Graphics quality' }), 'lightweight');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Motion' }), 'full');
    await user.click(screen.getByRole('checkbox', { name: 'Show navigation hint' }));
    expect(screen.queryByRole('button', { name: 'Dismiss navigation hint' })).not.toBeInTheDocument();
    expect(loadPreferences().value).toMatchObject({ timeMode: 'night', quality: 'lightweight', motion: 'full', guide: false });
    expect(lifecycle.model?.snapshot()).toMatchObject({ timeMode: 'night', quality: 'lightweight', reducedMotion: false });
  });

  it.each(['snow', 'windy'] as const)('selects and restores %s with natural weather off', async (weather) => {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify({
      ...DEFAULT_PREFERENCES, weather: 'rain', natural: true,
    }));
    const user = userEvent.setup();
    const firstVisit = render(<App />);
    await screen.findByText('City is living');
    expect(lifecycle.model?.snapshot().natural).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('checkbox', { name: 'Let the weather drift on its own' })).toBeChecked();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Weather' }), weather);
    expect(screen.getByRole('checkbox', { name: 'Let the weather drift on its own' })).not.toBeChecked();
    expect(lifecycle.model?.snapshot()).toMatchObject({ weather, natural: false });
    expect(loadPreferences().value).toMatchObject({ version: 1, weather, natural: false });
    expect(screen.getByText(new RegExp(`Afternoon.*${WEATHER_LABELS[weather]}`)))
      .toHaveTextContent(`Afternoon / ${WEATHER_LABELS[weather]}`);
    firstVisit.unmount();

    render(<App />);
    await screen.findByText('City is living');
    expect(lifecycle.model?.snapshot()).toMatchObject({ weather, natural: false });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('combobox', { name: 'Weather' })).toHaveValue(weather);
    const natural = screen.getByRole('checkbox', { name: 'Let the weather drift on its own' });
    expect(natural).not.toBeChecked();
    await user.click(natural);
    expect(natural).toBeChecked();
    expect(lifecycle.model?.snapshot().natural).toBe(true);
    expect(loadPreferences().value.natural).toBe(true);
  });

  it('reflects published natural weather in the badge without changing saved presets', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('checkbox', { name: 'Let the weather drift on its own' }));
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    for (const weather of ['snow', 'windy'] as const) {
      act(() => {
        lifecycle.model!.environment.setWeather(weather, true);
        lifecycle.model!.environment.setNatural(true);
        lifecycle.publish!();
      });
      expect(screen.getByText(new RegExp(`Afternoon.*${WEATHER_LABELS[weather]}`)))
        .toHaveTextContent(`Afternoon / ${WEATHER_LABELS[weather]}`);
      expect(loadPreferences().value).toMatchObject({ weather: 'sunny', natural: true });
    }
  });

  it('labels unsupported fullscreen honestly and Escape only exits that layer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    await user.click(screen.getByRole('button', { name: 'Expand view' }));
    expect(screen.getByRole('button', { name: 'Exit expanded view' })).toBeInTheDocument();
    screen.getByRole('region', { name: 'City navigation' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Expand view' })).toBeInTheDocument();
    expect(screen.queryByText(/Expanded view is active/)).not.toBeInTheDocument();
    expect(screen.getByText('Tour view')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Free view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start tour' })).toBeInTheDocument();
    lifecycle.command.mockClear();
    await user.keyboard('{Escape}');
    expect(lifecycle.command).not.toHaveBeenCalled();
  });
});
