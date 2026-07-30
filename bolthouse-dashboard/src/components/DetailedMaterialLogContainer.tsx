import { useEffect, useState, useRef, useCallback } from "react";
import { DetailedMaterialLog } from "./DetailedMaterialLog";
import {
  getDebrisBetweenDates,
  deleteDebrisDetection,
  type DebrisRecord,
} from "../api/debris";
import { computeRange } from "./ComputeRange";

interface DetailedMaterialLogContainerProps {
  selectedRange: string;
  specificDate?: Date | null;
  refreshKey?: number;
}

type Severity = "low" | "medium" | "high";

const norm = (v: string) => (v || "").toLowerCase().replace(/\s+/g, "");

function inferSeverity(material: string): Severity {
  const m = (material || "").toLowerCase();
  if (m.includes("glass") || m.includes("metal")) return "high";
  if (m.includes("stone") || m.includes("wire") || m.includes("plastic")) return "medium";
  return "low";
}

function timeFromTimestamp(timestamp: string) {
  const p = (timestamp || "").replace("T", " ").split(" ");
  return p[1] ?? timestamp;
}

function singleDayWindow(dayString: string) {
  const [y, m, d] = dayString.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const next = new Date(y, m - 1, d + 1);

  const toYMD = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;

  return {
    startTime: `${toYMD(start)} 00:00:00`,
    endTime: `${toYMD(next)} 00:00:00`,
  };
}

type MaterialLogDay = {
  day: string;
  date: string;
  totalDetections: number;
  detections: {
    id: string;
    eventId?: string;
    timestamp: string;
    material: string;
    severity: Severity;
    imageId?: string;
  }[];
};

function normalizeTs(ts: string) {
  return (ts || "").replace("T", " ");
}

function inRange(ts: string, start: string, end: string) {
  return ts >= start && ts < end;
}

export function DetailedMaterialLogContainer({
  selectedRange,
  specificDate = null,
  refreshKey = 0,
}: DetailedMaterialLogContainerProps) {
  const [materialLogs, setMaterialLogs] = useState<MaterialLogDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevRange = useRef(selectedRange);
  const prevDate = useRef(specificDate);
  const prevKey = useRef(refreshKey);

  const loadLogs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const information = computeRange(norm(selectedRange), specificDate);
      let startTime: string;
      let endTime: string;

      if (information.mode === "single-day") {
        ({ startTime, endTime } = singleDayWindow(information.dayString));
      } else {
        startTime = information.startTime;
        endTime = information.endTime;
      }

      const raw: DebrisRecord[] = await getDebrisBetweenDates(startTime, endTime);
      const debrisData = raw.filter((r) =>
        inRange(normalizeTs(r.time_stamp), startTime, endTime)
      );

      const byDay = new Map<string, DebrisRecord[]>();
      for (const row of debrisData) {
        const isoDay = normalizeTs(row.time_stamp).slice(0, 10);
        if (!byDay.has(isoDay)) byDay.set(isoDay, []);
        byDay.get(isoDay)!.push(row);
      }

      const logs: MaterialLogDay[] = Array.from(byDay.entries())
        .map(([isoDay, items]) => {
          items.sort((a, b) =>
            normalizeTs(b.time_stamp).localeCompare(normalizeTs(a.time_stamp))
          );
          const detections = items.map((item, idx) => {
            const material = item.debris_type || "unknown";
            return {
              id: `${normalizeTs(item.time_stamp)}-${idx}`,
              eventId: item.event_id,
              timestamp: timeFromTimestamp(item.time_stamp),
              material,
              severity: inferSeverity(material),
              imageId: item.image_path ? item.event_id : undefined,
            };
          });
          return {
            day: isoDay,
            date: new Date(`${isoDay}T00:00:00`).toLocaleDateString(),
            totalDetections: detections.length,
            detections,
          };
        })
        .sort((a, b) => (a.day < b.day ? 1 : -1));

      setMaterialLogs(logs);
    } catch (e) {
      console.error(e);
      setError("Failed to load detection logs.");
    } finally {
      setLoading(false);
    }
  }, [selectedRange, specificDate]);

  useEffect(() => {
    const rangeChanged = prevRange.current !== selectedRange;
    const dateChanged = prevDate.current !== specificDate;
    const keyChanged = prevKey.current !== refreshKey;
    const isBackgroundRefresh = keyChanged && !rangeChanged && !dateChanged;

    prevRange.current = selectedRange;
    prevDate.current = specificDate;
    prevKey.current = refreshKey;

    loadLogs(isBackgroundRefresh);
  }, [selectedRange, specificDate, refreshKey, loadLogs]);

  const handleDelete = async (target: {
    id: string;
    eventId: string;
    material: string;
  }) => {
    console.log("[delete] called with target:", target);
    setMaterialLogs(prev =>
      prev
        .map(day => ({
          ...day,
          detections: day.detections.filter(d => d.id !== target.id),
          totalDetections: day.detections.filter(d => d.id !== target.id).length,
        }))
        .filter(day => day.totalDetections > 0)
    );
    try {
      const result = await deleteDebrisDetection(target.eventId, target.material);
      console.log("[delete] success:", result);
    } catch (e) {
      console.error("[delete] failed:", e);
      loadLogs(true);
    }
  };

  if (loading && materialLogs.length === 0) {
    return <div className="text-sm text-muted-foreground">Loading detection logs...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>;
  }

  return (
    <div className={`transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
      <DetailedMaterialLog
        materialLogs={materialLogs}
        selectedRange={selectedRange}
        specificDate={specificDate}
        onDeleteDetection={handleDelete}
      />
    </div>
  );
}
