import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { API_BASE_URL } from "../api/config";

type DayCount = {
  date: string; // "YYYY-MM-DD"
  carrot_count: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** 0 = no data, 1-4 = increasing intensity buckets relative to this month's max */
function intensityBucket(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

const BUCKET_STYLES: Record<number, string> = {
  0: "bg-gray-800 text-gray-600",
  1: "bg-orange-950 text-orange-200",
  2: "bg-orange-800 text-orange-100",
  3: "bg-orange-600 text-white",
  4: "bg-orange-500 text-white",
};

export function CarrotsCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [countsByDate, setCountsByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const loadMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const start = `${year}-${pad2(month + 1)}-01T00:00:00`;
      const endDate = new Date(year, month + 1, 1);
      const end = `${endDate.getFullYear()}-${pad2(endDate.getMonth() + 1)}-01T00:00:00`;

      const res = await fetch(
        `${API_BASE_URL}/db/carrots/by-day?start=${start}&end=${end}`
      );
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();

      const map: Record<string, number> = {};
      for (const row of json.data ?? []) {
        map[row.date] = row.carrot_count;
      }
      setCountsByDate(map);
    } catch {
      setError("Couldn't load carrot data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y: number) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m: number) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y: number) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m: number) => m + 1);
    }
  };

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth]
  );

  const { weeks, maxCount } = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startWeekday = firstOfMonth.getDay(); // 0 = Sun

    const cells: (number | null)[] = [
      ...Array(startWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const weekRows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weekRows.push(cells.slice(i, i + 7));
    }

    const counts: number[] = Object.values(countsByDate);
    const max = counts.length > 0 ? Math.max(0, ...counts) : 0;
    return { weeks: weekRows, maxCount: max };
  }, [viewYear, viewMonth, countsByDate]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-semibold">Carrots Processed</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-gray-300 text-sm font-medium w-32 text-center">
            {monthLabel}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-56 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-56 text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-[11px] text-gray-500 font-medium"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {weeks.map((week: (number | null)[], wi: number) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day: number | null, di: number) => {
                  if (day === null) {
                    return <div key={di} className="aspect-square" />;
                  }
                  const dateStr = isoDate(viewYear, viewMonth, day);
                  const count = countsByDate[dateStr] ?? 0;
                  const bucket = intensityBucket(count, maxCount);
                  const isHovered = hoveredDay === dateStr;

                  return (
                    <div
                      key={di}
                      onMouseEnter={() => setHoveredDay(dateStr)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`aspect-square rounded-md flex flex-col items-center justify-center relative cursor-default transition-transform ${BUCKET_STYLES[bucket]} ${
                        isHovered ? "scale-105 ring-1 ring-orange-400" : ""
                      }`}
                    >
                      <span className="text-[11px] leading-none">{day}</span>
                      {count > 0 && (
                        <span className="text-[9px] leading-none mt-0.5 font-semibold">
                          {count}
                        </span>
                      )}
                      {isHovered && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[11px] text-white whitespace-nowrap z-10 shadow-lg">
                          {dateStr}: {count} carrot{count === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-4 justify-end">
            <span className="text-[11px] text-gray-500 mr-1">Less</span>
            {[0, 1, 2, 3, 4].map((bucket) => (
              <div
                key={bucket}
                className={`w-3 h-3 rounded-sm ${BUCKET_STYLES[bucket].split(" ")[0]}`}
              />
            ))}
            <span className="text-[11px] text-gray-500 ml-1">More</span>
          </div>
        </>
      )}
    </div>
  );
}
