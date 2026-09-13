import { Modal } from './Modal';

interface HelpProps {
  reduced: boolean;
  onReducedChange: (reduced: boolean) => void;
  onClose: () => void;
}

const SHORTCUTS = [
  ['Arrow keys', 'Pan around the square'],
  ['+ / -', 'Zoom in / out'],
  ['Q / E', 'Rotate left / right'],
  ['W / S', 'Tilt toward overhead / street level'],
  ['R', 'Reset overview'],
  ['[ / ]', 'Previous / next landmark'],
  ['T', 'Start / stop tour or guided views'],
  ['Space', 'Pause / resume city'],
  ['F', 'Fullscreen / expanded view'],
  ['Escape', 'Close panel, exit view, stop tour, then clear selection'],
  ['?', 'Open keyboard help'],
];

export function KeyboardShortcuts() {
  return <>
    <p className="muted">Shortcuts work only when the city navigation area has focus. Tab always moves between controls.</p>
    <dl className="shortcuts">{SHORTCUTS.map(([keys, action]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}</dl>
  </>;
}

export function Help({ reduced, onReducedChange, onClose }: HelpProps) {
  return <Modal title="City controls" closeLabel="Close help" onClose={onClose}>
    <p>Drag to pan. Command-drag on Mac, Control-drag, or right-drag rotates and tilts around the city. Scroll or pinch to get closer. Shift-scroll and two-finger sideways gestures rotate horizontally. Camera buttons offer the same controls.</p>
    <p>You can explore the entire modeled district. Panning stops at its outer edge, and tilt stays between a street-facing angle and an overhead view so the camera cannot disappear underground. Reset returns to the original overview.</p>
    <p>Choose a landmark to settle into its view. Any manual camera movement takes you back to free exploration. Buses, yellow cabs, delivery vans, trucks, cyclists, and walkers go about their day on their own.</p>
    <p>Look for two-way green cycle tracks, traffic waiting at intersections, rooftop water tanks, fire escapes, subway entrances, and the neighborhood court. The park is car-free: walkers use gates connected to the sidewalks, and runners circle the reservoir. Street signals and every moving actor freeze when you pause.</p>
    <p>At Juniper Court, neighbors play basketball and pickleball. These are ambient scenes, not interactive games; reduced motion holds the players and balls still.</p>
    <h3>Keyboard shortcuts</h3>
    <KeyboardShortcuts />
    <label className="motion-control"><input type="checkbox" checked={reduced} onChange={(event) => onReducedChange(event.target.checked)} /><span>Reduce motion<small>Starts paused, with immediate focus views. You can still choose to resume the city.</small></span></label>
    <p>Start a tour with no selection for a district route, or select a landmark for a slow series of nearby views. Moving the camera or opening a panel stops it. Reduced motion uses explicit Previous and Next views instead.</p>
    <p className="muted">Sound starts off on every visit. Settings stay on this computer only. No accounts or tracking.</p>
  </Modal>;
}
