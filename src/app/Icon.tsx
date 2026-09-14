export type IconName = 'pause' | 'play' | 'home' | 'left' | 'right' | 'up' | 'down' | 'plus' | 'minus' | 'rotate-left' | 'rotate-right' | 'tilt-up' | 'tilt-down' | 'close' | 'help' | 'sun' | 'leaf' | 'expand' | 'settings';

const paths: Record<IconName, string> = {
  pause: 'M8 5v14M16 5v14',
  play: 'm8 5 11 7-11 7Z',
  home: 'm3 11 9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  'rotate-left': 'M4 4v6h6M4 10a8 8 0 1 1 0 5',
  'rotate-right': 'M20 4v6h-6M20 10a8 8 0 1 0 0 5',
  'tilt-up': 'm3 16 9-4 9 4-9 4ZM12 10V3M8 7l4-4 4 4',
  'tilt-down': 'm3 17 9-3 9 3-9 3ZM12 3v8M8 7l4 4 4-4',
  close: 'm6 6 12 12M6 18 18 6',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  sun: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  leaf: 'M5 19C-2 9 9 2 21 3c0 12-8 20-16 16ZM5 19l10-10',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  settings: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
};
export function Icon({ name }: { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
