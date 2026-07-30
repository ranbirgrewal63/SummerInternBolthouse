import { useEffect, useState, useRef } from "react";
import { MetricsCards } from "./MetricsCards";
import { getDebrisBetweenDates } from "../api/debris";
import { getCarrotsBetweenDates } from "../api/carrots";
import { computeRange } from "./ComputeRange";

interface MetricsCardsContainerProps {
  selectedRange: string;
  specificDate?: Date | null;
  refreshKey?: number;
}

const norm = (v: string) => (v || "").toLowerCase().replace(/\s+/g, "");

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

function uniqueBy<T>(arrgument: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arrgument) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export function MetricsCardsContainer({
  selectedRange,
  specificDate = null,
  refreshKey = 0,
}: MetricsCardsContainerProps) {
  const [detectionsCount, setDetectionsCount] = useState<number | null>(null);
  const [processedCount, setProcessedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prevRange = useRef(selectedRange);
  const prevDate = useRef(specificDate);
  const prevKey = useRef(refreshKey);

   useEffect(() => {
     async function load() {
       try {
         // Determine if this is a "background refresh" (only refreshKey changed)
         const rangeChanged = prevRange.current !== selectedRange;
         const dateChanged = prevDate.current !== specificDate;
         const keyChanged = prevKey.current !== refreshKey;

         const isBackgroundRefresh = keyChanged && !rangeChanged && !dateChanged;

         // Update refs
         prevRange.current = selectedRange;
         prevDate.current = specificDate;
         prevKey.current = refreshKey;

         if (!isBackgroundRefresh) {
           setLoading(true);
         }
         setError(null);

         const information = computeRange(norm(selectedRange), specificDate);

         let startTime: string, endTime: string;
         if (information.mode === "single-day") {
           ({ startTime, endTime } = singleDayWindow(information.dayString));
         } else {
           startTime = information.startTime;
           endTime = information.endTime;
         }
         const startTimeT = startTime.replace(" ", "T");
         const endTimeT = endTime.replace(" ", "T");


         const [debrisRows, carrotRows] = await Promise.all([
           getDebrisBetweenDates(startTime, endTime),
           getCarrotsBetweenDates(startTimeT, endTimeT),
         ]);

         const normalizeTimestamp = (s: string) => (s || "").replace("T", " ");
         const inRange = (timestamp: string) => {
           const t = normalizeTimestamp(timestamp);
           return t >= startTime && t < endTime;
         };

         const debrisInRange = (debrisRows ?? []).filter((d: any) => inRange(d.time_stamp));
         const carrotsInRange = (carrotRows ?? []).filter((c: any) => inRange(c.time_stamp));

         const carrotsDistinct = uniqueBy(
           carrotsInRange,
           (c: any) => String(c.id)
         );

         setDetectionsCount(debrisInRange.length);
         setProcessedCount(carrotsDistinct.length);
       } catch (e) {
         console.error(e);
         setError("Failed to load metrics.");
       } finally {
         setLoading(false);
       }
     }
     load();
   }, [selectedRange, specificDate, refreshKey]);

  if (loading && (detectionsCount === null || processedCount === null)) return <div className="p-4 text-sm text-gray-500">Loading metrics...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (detectionsCount === null || processedCount === null) return null;

  return (
    <div className={`transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
      <MetricsCards
        todayDetections={detectionsCount}
        totalProcessed={processedCount}
        selectedRange={selectedRange}
      />
    </div>
  );
}
