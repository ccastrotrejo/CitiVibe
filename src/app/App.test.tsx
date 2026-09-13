import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { CONTENT } from '../content/city';
import type { WorldModel } from '../world/model';
import type { WorldCommand } from '../world/types';

const lifecycle = vi.hoisted(() => ({ fail: false, dispose: vi.fn() }));
vi.mock('../world/createWorld', () => ({
  createWorld({ model, onChange, onLifecycle }: { model: WorldModel; onChange: () => void; onLifecycle: (state: string, message: string) => void }) {
    if (lifecycle.fail) throw new Error('WebGL2 is unavailable. Explore the static city.');
    onLifecycle('ready', 'Ready.');
    return {
      command(command: WorldCommand) { model.command(command); onChange(); },
      dispose: lifecycle.dispose,
    };
  },
}));

beforeEach(() => {
  window.localStorage.clear();
  lifecycle.fail = false;
  lifecycle.dispose.mockClear();
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

  it('connects pause, focus cycling, and manual interruption without follow controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next landmark' }));
    expect(screen.getByText('Landmark view')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('Free view')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause city' }));
    await user.click(screen.getByRole('button', { name: 'Reset overview' }));
    await user.click(screen.getByRole('button', { name: 'Next landmark' }));
    expect(screen.getAllByText('Rainlight Pavilion')[0]).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next landmark' }));
    expect(screen.getAllByText('Terrace Steps')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume city' })).toBeEnabled();
  });

  it('scopes shortcuts to the navigation region, not buttons', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    screen.getByRole('button', { name: 'Zoom in' }).focus();
    await user.keyboard(']');
    expect(screen.queryByText('Landmark view')).not.toBeInTheDocument();
    screen.getByRole('region', { name: 'City navigation' }).focus();
    await user.keyboard('bd');
    expect(screen.getByText('Overview')).toBeInTheDocument();
    await user.keyboard(']');
    expect(screen.getByText('Landmark view')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Free view')).toBeInTheDocument();
  });

  it('restores help focus without resuming camera movement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Next landmark' }));
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

  it('retains noncommercial focus navigation after renderer failure and retry', async () => {
    lifecycle.fail = true;
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/WebGL2 is unavailable/);
    expect(screen.getByRole('button', { name: 'Pause city' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next landmark' }));
    expect(screen.getAllByText('Rainlight Pavilion').length).toBeGreaterThan(0);
    lifecycle.fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry live city' }));
    await screen.findByText('City is living');
    expect(screen.getAllByText('Rainlight Pavilion')[0]).toBeInTheDocument();
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
    await user.selectOptions(screen.getByLabelText('Motion'), 'reduced');
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(trigger).toHaveFocus();
    expect(screen.getByText('Free view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume city' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Guided views' }));
    await user.click(screen.getByRole('button', { name: 'Next view' }));
    expect(screen.getByText(`Guided view 2 / ${CONTENT.tourAnchorIds.length}`, { exact: false })).toBeInTheDocument();
    expect(window.localStorage.getItem('livingcity.preferences')).toContain('"motion":"reduced"');
  });

  it('wires sound settings to audio status and saved preferences', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    expect(screen.getByText('Sound off')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    await screen.findByText('Sound error');
    expect(screen.getByText(/Web Audio is unavailable/)).toBeInTheDocument();
    expect(window.localStorage.getItem('livingcity.preferences')).toContain('"muted":false');
  });

  it('labels unsupported fullscreen honestly and Escape only exits that layer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('City is living');
    await user.click(screen.getByRole('button', { name: 'Next landmark' }));
    await user.click(screen.getByRole('button', { name: 'Expand view' }));
    expect(screen.getByRole('button', { name: 'Exit expanded view' })).toBeInTheDocument();
    screen.getByRole('region', { name: 'City navigation' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Expand view' })).toBeInTheDocument();
    expect(screen.queryByText(/Expanded view is active/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Rainlight Pavilion')[0]).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Rainlight Pavilion')).not.toBeInTheDocument();
  });
});
