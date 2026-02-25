// ============================================================================
// useAlarms — WebSocket alarm listener + Web Audio API sound
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getCurrentSubscription } from '../lib/pushSubscription';

// Compute WebSocket URL at runtime so it works in all deployment scenarios:
//   VITE_API_URL = '/api'          → relative URL → use current origin
//     (nginx proxies /socket.io/ to the backend — same host, works for local + external)
//   VITE_API_URL = 'http://host:3001/api' → absolute URL → strip /api
//     (direct connection, used in local dev without nginx)
const _apiUrl = import.meta.env.VITE_API_URL as string | undefined;
const WS_URL  = (!_apiUrl || _apiUrl.startsWith('/'))
  ? window.location.origin                // nginx will proxy /socket.io/
  : _apiUrl.replace(/\/api$/, '');

export interface AlarmEvent {
  type:     string;
  level:    'urgent' | 'warning';
  sgv?:     number;
  message:  string;
  timestamp: number;
}

// ── Web Audio API helpers ─────────────────────────────────────────────────────

function playBeep(
  ctx: AudioContext,
  frequency: number,
  startSec: number,
  durationSec: number,
  volume = 0.6,
) {
  const osc   = ctx.createOscillator();
  const gain  = ctx.createGain();
  osc.type    = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, startSec);
  gain.gain.exponentialRampToValueAtTime(0.001, startSec + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startSec);
  osc.stop(startSec + durationSec + 0.05);
}

function playAlarmSound(level: 'urgent' | 'warning') {
  try {
    const ctx = new AudioContext();
    if (level === 'urgent') {
      // 3 pulsos de 880 Hz
      [0, 0.45, 0.9].forEach((t) => playBeep(ctx, 880, ctx.currentTime + t, 0.25));
    } else {
      // 1 pulso de 440 Hz
      playBeep(ctx, 440, ctx.currentTime, 0.6);
    }
  } catch {
    // Ignore AudioContext errors (e.g., user gesture restriction)
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAlarms() {
  const [activeAlarm, setActiveAlarm] = useState<AlarmEvent | null>(null);
  const socketRef   = useRef<Socket | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on('alarm', (event: AlarmEvent) => {
      setActiveAlarm(event);
      playAlarmSound(event.level);

      // Auto-dismiss after 5 min
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setActiveAlarm(null), 5 * 60_000);
    });

    return () => {
      socket.disconnect();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const dismissAlarm = useCallback(() => {
    setActiveAlarm(null);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  const snoozeAlarm = useCallback(async () => {
    if (!activeAlarm) return;
    try {
      const sub = await getCurrentSubscription();
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      if (sub) {
        await fetch(`${apiBase}/push/snooze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            subscriptionEndpoint: sub.endpoint,
            alarmType:            activeAlarm.type,
            durationMinutes:      30,
          }),
        });
      }
    } catch {
      // Ignore network errors — snooze is best-effort
    }
    dismissAlarm();
  }, [activeAlarm, dismissAlarm]);

  return { activeAlarm, dismissAlarm, snoozeAlarm };
}
