import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const exitedAt = useRef(-Infinity);
  const wasFullscreen = useRef(false);
  const supported = Boolean(document.fullscreenEnabled);

  useEffect(() => {
    const change = () => {
      const active = document.fullscreenElement === target.current;
      if (wasFullscreen.current && !active) exitedAt.current = performance.now();
      wasFullscreen.current = active;
      setFullscreen(active);
      if (active) setExpanded(false);
    };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, [target]);

  async function toggle() {
    setMessage('');
    if (expanded) { setExpanded(false); return; }
    if (!supported) {
      setExpanded(true);
      setMessage('Expanded view is active. This is an in-page view, not browser fullscreen.');
      return;
    }
    try {
      if (document.fullscreenElement === target.current) await document.exitFullscreen();
      else if (target.current) await target.current.requestFullscreen();
    } catch {
      setMessage('Browser fullscreen was not allowed. You can use expanded view instead.');
    }
  }

  return {
    fullscreen, expanded, message, toggle,
    expand: () => { setExpanded(true); setMessage('Expanded view is active, not browser fullscreen.'); },
    exitExpanded: () => { setExpanded(false); setMessage(''); },
    blocksEscape: () => Boolean(document.fullscreenElement) || performance.now() - exitedAt.current < 250,
    label: fullscreen ? 'Exit fullscreen' : expanded ? 'Exit expanded view' : supported ? 'Fullscreen' : 'Expand view',
  };
}
