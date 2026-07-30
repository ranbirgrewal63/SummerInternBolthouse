import { useEffect, useState, useRef } from "react";
import { DetectionChart } from "./DetectionChart";
import { computeRange } from "./ComputeRange";

import { getDebrisBetweenDates, type DebrisRecord } from "../api/debris";
import { getCarrotsBetweenDates, type CarrotRecord } from "../api/carrots";

export interface DetectionData {
  time: string;
  rangeLabel?: string;
  detections: number;
  processed: number;
  plastic?: number;
  metal?: number;
  wire?: number;
  root?: number;
  foreign_material?: number;
  unknown?: number;
}

interface Props {
  selectedRange?: string;
  specificDate?: Date | null;
  refreshKey?: number;
  onChartDataChange?: (data: DetectionData[]) => void;
}

const norm = (v: string) => (v || "").toLowerCase().replace(/\s+/g, "");

function singleDayWindow(dayString: string) {
  const [y, m, d] = dayString.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const next = new Date(y, m - 1, d + 1);
  const toYMD = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return {
    startTime: `${toYMD(start)} 00:00:00`,
    endTime: `${toYMD(next)} 00:00:00`,
  };
}

const normalizeTs = (ts: string) => (ts || "").replace("T", " ");
const inRange = (ts: string, start: string, end: string) => ts >= start && ts < end;


function dateKey(ts: string) { return normalizeTs(ts).slice(0, 10); }



export function DetectionChartContainer({
  selectedRange = "today",
  specificDate = null,
  refreshKey = 0,
  onChartDataChange,
}: Props) {
  const [chartData, setChartData] = useState<DetectionData[]>([]);
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

         const [debrisDataRaw, carrotDataRaw]: [DebrisRecord[], CarrotRecord[]] = await Promise.all([
           getDebrisBetweenDates(startTime, endTime),
           getCarrotsBetweenDates(startTime, endTime),
         ]);

         const debrisData = (debrisDataRaw || []).filter(d => inRange(normalizeTs(d.time_stamp), startTime, endTime));
         const carrotData = (carrotDataRaw || []).filter(c => inRange(normalizeTs(c.time_stamp), startTime, endTime));
          if (information.mode === "single-day") {
            const twoHourBlocks = Array.from({ length: 12 }, (_, i) => {
            const start = i * 2;
            const end = start + 2;
            return {
              start,
              end,
              rangeLabel: `${String(start).padStart(2, "0")}:00 - ${String(end).padStart(2, "0")}:00`,
              timeLabel: `${String(end).padStart(2, "0")}:00`,
              detections: 0,
              processed: 0,
              plastic: 0,
              metal: 0,
              wire: 0,
              root: 0,
              foreign_material: 0,
              unknown: 0,
            };
          });

          // Count debris
          for (const d of debrisData) {
            const h = Number(normalizeTs(d.time_stamp).slice(11, 13));
            const blockIndex = Math.floor(h / 2);

            if (blockIndex >= 0 && blockIndex < 12) {
              twoHourBlocks[blockIndex].detections++;

              const material = (d.debris_type || "unknown").toLowerCase();
              if (material === "plastic") twoHourBlocks[blockIndex].plastic++;
              else if (material === "metal") twoHourBlocks[blockIndex].metal++;
              else if (material === "wire") twoHourBlocks[blockIndex].wire++;
              else if (material === "root") twoHourBlocks[blockIndex].root++;
              else if (material === "foreign_material") twoHourBlocks[blockIndex].foreign_material++;
              else twoHourBlocks[blockIndex].unknown++;
            }
          }

          // Count carrots
          for (const c of carrotData) {
            const h = Number(normalizeTs(c.time_stamp).slice(11, 13));
            const blockIndex = Math.floor(h / 2);
            if (blockIndex >= 0 && blockIndex < 12) {
              twoHourBlocks[blockIndex].processed++;
            }
          }

          const finalData = twoHourBlocks.map((b) => ({
          time: b.timeLabel,
          rangeLabel: b.rangeLabel,
          detections: b.detections,
          processed: b.processed,
          plastic: b.plastic,
          metal: b.metal,
          wire: b.wire,
          root: b.root,
          foreign_material: b.foreign_material,
          unknown: b.unknown,
          }));

            setChartData(finalData);
          }
          else if (norm(selectedRange) === "last30days") {
           // Weekly aggregation
           const weeks: { start: Date; end: Date; label: string; detections: number; processed: number }[] = [];
           const start = new Date(startTime.slice(0, 10) + "T00:00:00");
           const end = new Date(endTime.slice(0, 10) + "T00:00:00");

           let current = new Date(start);
           while (current < end) {
             const nextWeek = new Date(current);
             nextWeek.setDate(current.getDate() + 7);
             if (nextWeek > end) nextWeek.setTime(end.getTime());

             weeks.push({
               start: new Date(current),
               end: new Date(nextWeek),
               label: `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${nextWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
               detections: 0,
               processed: 0
             });
             current = nextWeek;
           }

           // Count debris
           for (const d of debrisData) {
             const dt = new Date(normalizeTs(d.time_stamp));
             for (const w of weeks) {
               if (dt >= w.start && dt < w.end) {
                 w.detections++;
                 break;
               }
             }
           }

           // Count carrots
           for (const c of carrotData) {
             const dt = new Date(normalizeTs(c.time_stamp));
             for (const w of weeks) {
               if (dt >= w.start && dt < w.end) {
                 w.processed++;
                 break;
               }
             }
           }

           setChartData(weeks.map(w => ({
             time: w.label,
             detections: w.detections,
             processed: w.processed
           })));

         } else if (norm(selectedRange) === "last3months") {
           // 2-Week aggregation
           const twoWeeks: { start: Date; end: Date; label: string; detections: number; processed: number }[] = [];
           const start = new Date(startTime.slice(0, 10) + "T00:00:00");
           const end = new Date(endTime.slice(0, 10) + "T00:00:00");

           let current = new Date(start);
           while (current < end) {
             const nextBlock = new Date(current);
             nextBlock.setDate(current.getDate() + 14);
             if (nextBlock > end) nextBlock.setTime(end.getTime());

             twoWeeks.push({
               start: new Date(current),
               end: new Date(nextBlock),
               label: `${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${nextBlock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
               detections: 0,
               processed: 0
             });
             current = nextBlock;
           }

           for (const d of debrisData) {
             const dt = new Date(normalizeTs(d.time_stamp));
             for (const w of twoWeeks) {
               if (dt >= w.start && dt < w.end) {
                 w.detections++;
                 break;
               }
             }
           }

           for (const c of carrotData) {
             const dt = new Date(normalizeTs(c.time_stamp));
             for (const w of twoWeeks) {
               if (dt >= w.start && dt < w.end) {
                 w.processed++;
                 break;
               }
             }
           }

           setChartData(twoWeeks.map(w => ({
             time: w.label,
             detections: w.detections,
             processed: w.processed
           })));

         } else if (norm(selectedRange) === "thisyear" || norm(selectedRange) === "lastyear") {
           // Monthly aggregation
           const months: { start: Date; end: Date; label: string; detections: number; processed: number }[] = [];
           const start = new Date(startTime.slice(0, 10) + "T00:00:00");
           const end = new Date(endTime.slice(0, 10) + "T00:00:00");

           let current = new Date(start);
           // Align to start of month if needed, but usually start is Jan 1
           while (current < end) {
             const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
             if (nextMonth > end) nextMonth.setTime(end.getTime());
             // If we are already past end, break
             if (current >= end) break;

             months.push({
               start: new Date(current),
               end: new Date(nextMonth),
               label: current.toLocaleDateString('en-US', { month: 'long' }),
               detections: 0,
               processed: 0
             });
             current = nextMonth;
           }

           for (const d of debrisData) {
             const dt = new Date(normalizeTs(d.time_stamp));
             for (const m of months) {
               if (dt >= m.start && dt < m.end) {
                 m.detections++;
                 break;
               }
             }
           }

           for (const c of carrotData) {
             const dt = new Date(normalizeTs(c.time_stamp));
             for (const m of months) {
               if (dt >= m.start && dt < m.end) {
                 m.processed++;
                 break;
               }
             }
           }

           setChartData(months.map(m => ({
             time: m.label,
             detections: m.detections,
             processed: m.processed
           })));

         } else {
           // Default Daily Aggregation (e.g. last 7 days)
          const debrisByDay: Record<string, number> = {};
          for (const d of debrisData) {
            const k = dateKey(d.time_stamp); 
            debrisByDay[k] = (debrisByDay[k] ?? 0) + 1;
          }
          const carrotsByDay: Record<string, number> = {};
          for (const c of carrotData) {
            const k = dateKey(c.time_stamp);
            carrotsByDay[k] = (carrotsByDay[k] ?? 0) + 1;
          }
          const debrisByDayAndType: Record<string, Record<string, number>> = {};
          for (const d of debrisData) {
            const k = dateKey(d.time_stamp);
            const material = (d.debris_type || "unknown").toLowerCase();
            if (!debrisByDayAndType[k]) {
              debrisByDayAndType[k] = {};
              }
              debrisByDayAndType[k][material] = (debrisByDayAndType[k][material] ?? 0) + 1;
            }

            const dayList: string[] = [];
            {
              const startDate = new Date(startTime.slice(0, 10) + "T00:00:00");
              const endDate = new Date(endTime.slice(0, 10) + "T00:00:00");
              for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                dayList.push(`${y}-${m}-${day}`);
              }
            }

            const allMaterials = ["plastic", "metal", "wire", "root", "foreign_material", "unknown"];
            setChartData(dayList.map(ymd => {
              const [y, m, d] = ymd.split("-").map(Number);
              const dt = new Date(y, m - 1, d);

              const row: any = {
                time: dt.toLocaleDateString(),
                detections: debrisByDay[ymd] ?? 0,
                processed: carrotsByDay[ymd] ?? 0,
              };

              for (const material of allMaterials) {
                row[material] = debrisByDayAndType[ymd]?.[material] ?? 0;
              }
              return row;
            }));

         }
       } catch (e) {
         console.error(e);
         setError("Failed to load chart data from backend.");
       } finally {
         setLoading(false);
       }
     }
     load();
   }, [selectedRange, specificDate, refreshKey]);

  useEffect(() => {
    onChartDataChange?.(chartData);
  }, [chartData, onChartDataChange]);

  if (loading && chartData.length === 0) {
    return <div className="p-4 text-sm text-gray-500">Loading chart...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className={`transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
      <DetectionChart
        data={chartData}
        specificDate={specificDate}
      />
    </div>
  );
}
