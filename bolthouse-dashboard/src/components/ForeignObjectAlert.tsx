/**
 * ForeignObjectAlert.tsx  —  NEW FILE
 * Place at: bolthouse-dashboard/src/components/ForeignObjectAlert.tsx
 *
 * Polls /sound/latest-foreign-object every 4 s.
 * Plays a beep (Web Audio API, no audio file needed) when a NEW
 * foreign object event arrives.
 * Shows a floating pill in the bottom-right with a Sound ON/OFF toggle.
 * Uses the project's existing Switch + Badge components so it matches the UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { API_BASE_URL } from "../api/config";

const POLL_MS  = 4_000;
const ALERT_GROUP_WINDOW_MS = 6_000;

interface DetectionResponse {
  found:       boolean;
  eventId?:    string;
  timestamp?:  string;
  label?:      string;
  confidence?: number;
}

/** Two-tone alert beep synthesised entirely in the browser — no file needed. */
function playBeep(ctx: AudioContext) {
  [880, 660].forEach((freq, i) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    const t = ctx.currentTime + i * 0.27;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

export function ForeignObjectAlert() {
  const [soundOn,     setSoundOn]     = useState(true);
  const [alert,       setAlert]       = useState<DetectionResponse | null>(null);
  const [flash,       setFlash]       = useState(false);
  const [offline,     setOffline]     = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const lastAlertTimestampRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const getCtx   = useCallback(() => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    return audioRef.current;
  }, []);

  useEffect(() => {
    const storedEventId = window.sessionStorage.getItem("foreign-object-last-event-id");
    const storedAlertTimestamp = window.sessionStorage.getItem("foreign-object-last-alert-ts");
    if (storedEventId) {
      lastEventIdRef.current = storedEventId;
    }
    if (storedAlertTimestamp) {
      const parsed = Number(storedAlertTimestamp);
      if (!Number.isNaN(parsed)) {
        lastAlertTimestampRef.current = parsed;
      }
    }
  }, []);

  // Unlock AudioContext on first user gesture (browser policy)
  useEffect(() => {
    const unlock = () => getCtx().resume();
    window.addEventListener("click", unlock, { once: true });
    return () => window.removeEventListener("click", unlock);
  }, [getCtx]);

  // Polling loop
  useEffect(() => {
    let dead = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/sound/latest-foreign-object`);
        const data: DetectionResponse = await res.json();
        setOffline(false);

        const previousEventId = lastEventIdRef.current;
        if (data.found && data.eventId && data.eventId !== previousEventId) {
          const eventTime = data.timestamp ? Date.parse(data.timestamp) : NaN;
          const previousAlertTime = lastAlertTimestampRef.current;
          const withinGroupedAlertWindow = (
            Number.isFinite(eventTime)
            && previousAlertTime !== null
            && eventTime - previousAlertTime <= ALERT_GROUP_WINDOW_MS
          );

          lastEventIdRef.current = data.eventId;
          window.sessionStorage.setItem("foreign-object-last-event-id", data.eventId);
          setAlert(data);
          setFlash(true);

          if (flashTimeoutRef.current !== null) {
            window.clearTimeout(flashTimeoutRef.current);
          }
          flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 3_000);

          if (soundOn && !withinGroupedAlertWindow) {
            try { const c = getCtx(); await c.resume(); playBeep(c); }
            catch { /* audio blocked until user gesture */ }
          }

          if (Number.isFinite(eventTime)) {
            lastAlertTimestampRef.current = eventTime;
            window.sessionStorage.setItem("foreign-object-last-alert-ts", String(eventTime));
          }
        }
      } catch {
        setOffline(true);
      }

      if (!dead) {
        timeoutId = window.setTimeout(poll, POLL_MS);
      }
    };

    void poll();
    return () => {
      dead = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [getCtx, soundOn]);

  return (
    <div
      style={{
        position:      "fixed",
        bottom:        "1.5rem",
        right:         "1.5rem",
        zIndex:        9999,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "flex-end",
        gap:           "0.5rem",
        pointerEvents: "none",   // clicks pass through to the page except the pill
      }}
    >
      {/* ── Alert toast — appears for 3 s on new detection ── */}
      {flash && alert && (
        <div
          style={{
            pointerEvents: "none",
            background:    "hsl(0 60% 12%)",
            border:        "1px solid hsl(0 65% 45%)",
            borderRadius:  "0.75rem",
            padding:       "0.75rem 1rem",
            boxShadow:     "0 4px 24px rgba(0,0,0,0.5)",
            maxWidth:      "240px",
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"0.25rem" }}>
            <AlertTriangle size={13} color="#f87171" />
            <span style={{ fontSize:"0.68rem", fontWeight:700, color:"#f87171", textTransform:"uppercase", letterSpacing:"0.07em" }}>
              Foreign Object Detected
            </span>
          </div>
          <p style={{ margin:0, fontSize:"0.82rem", color:"#f1f5f9", fontWeight:600 }}>
            {alert.label}
            {alert.confidence !== undefined && (
              <span style={{ fontWeight:400, color:"#94a3b8" }}>
                {" "}· {Math.round(alert.confidence * 100)}% conf
              </span>
            )}
          </p>
          <p style={{ margin:"0.2rem 0 0", fontSize:"0.65rem", color:"#64748b" }}>
            {alert.timestamp}
          </p>
        </div>
      )}

      {/* ── Control pill — always visible ── */}
      <div
        style={{
          pointerEvents: "auto",
          display:       "flex",
          alignItems:    "center",
          gap:           "0.6rem",
          background:    flash ? "hsl(0 60% 18%)" : "hsl(222 47% 11%)",
          border:        flash ? "1.5px solid hsl(0 65% 45%)" : "1.5px solid hsl(215 28% 22%)",
          borderRadius:  "9999px",
          padding:       "0.4rem 0.85rem 0.4rem 0.65rem",
          boxShadow:     flash
            ? "0 0 18px 4px rgba(239,68,68,0.35)"
            : "0 2px 12px rgba(0,0,0,0.4)",
          transition:    "all 0.3s ease",
          userSelect:    "none",
          cursor:        "default",
        }}
      >
        {/* Status dot */}
        <span style={{
          width:        "8px",
          height:       "8px",
          borderRadius: "50%",
          flexShrink:   0,
          background:   offline ? "#f59e0b" : flash ? "#f87171" : "#22c55e",
          boxShadow:    flash ? "0 0 6px #f87171" : "none",
          transition:   "background 0.2s",
        }} />

        {/* Label */}
        <span style={{ fontSize:"0.72rem", fontWeight:600, color: flash ? "#fca5a5" : "#94a3b8", whiteSpace:"nowrap" }}>
          {offline ? "Alert offline" : flash ? `⚠ ${alert?.label}` : "Monitoring"}
        </span>

        {/* Badge */}
        <Badge
          variant="outline"
          style={{ fontSize:"0.65rem", padding:"0 0.4rem", borderColor: soundOn ? "#22c55e" : "#64748b", color: soundOn ? "#22c55e" : "#64748b" }}
        >
          {soundOn ? "Sound ON" : "Sound OFF"}
        </Badge>

        {/* Icon */}
        {soundOn
          ? <Volume2  size={14} color="#22c55e" />
          : <VolumeX  size={14} color="#64748b" />
        }

        {/* Toggle — uses the project's existing Switch component */}
        <Switch
          checked={soundOn}
          onCheckedChange={setSoundOn}
          aria-label="Toggle foreign object alert sound"
        />
      </div>
    </div>
  );
}
