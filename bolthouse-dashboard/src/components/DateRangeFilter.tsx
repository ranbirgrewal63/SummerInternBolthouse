import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { runModelInference } from "../api/model";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getDebrisBetweenDates } from "../api/debris";
import { getCarrotsBetweenDates } from "../api/carrots";
import { computeRange } from "./ComputeRange";

import {
  Calendar as CalendarIcon,
  Download,
  CalendarDays,
  FileText,
  Table,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";

interface DateRangeFilterProps {
  selectedRange: string;
  specificDate?: Date | null;
  onDateRangeChange: (range: string) => void;
  onSpecificDateSelect: (date: Date | null) => void;
  masterDataStore: Map<string, any>;
  onInferenceImageSelect?: (file: File) => void;
  graphData?: any[];
}

const norm = (v: string) => (v || "").toLowerCase().replace(/\s+/g, "");

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function singleDayWindow(dayString: string) {
  const [y, m, d] = dayString.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const next = new Date(y, m - 1, d + 1);
  return {
    startTime: `${toYMD(start)} 00:00:00`,
    endTime: `${toYMD(next)} 00:00:00`,
  };
}

function normalizeTimestamp(value: string) {
  return (value || "").replace("T", " ");
}

function inRange(timestamp: string, startTime: string, endTime: string) {
  const normalized = normalizeTimestamp(timestamp);
  return normalized >= startTime && normalized < endTime;
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function subtractOneDay(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return toYMD(new Date(y, m - 1, d - 1));
}

function formatRangeLabel(selectedRange: string, specificDate: Date | null, startTime: string, endTime: string) {
  if (specificDate) {
    return specificDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const labels: Record<string, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last7days: "Last 7 Days",
    last30days: "Last 30 Days",
    last3months: "Last 3 Months",
    last6months: "Last 6 Months",
    lastyear: "Last Year",
    thismonth: "This Month",
    thisyear: "This Year",
  };
  const key = norm(selectedRange);
  const pretty = labels[key];
  if (pretty) {
    return `${pretty} (${startTime.slice(0, 10)} to ${subtractOneDay(endTime.slice(0, 10))})`;
  }
  return `${startTime.slice(0, 10)} to ${subtractOneDay(endTime.slice(0, 10))}`;
}

function makeExportSlug(selectedRange: string, specificDate: Date | null, startTime: string, endTime: string) {
  if (specificDate) {
    return startTime.slice(0, 10);
  }

  const key = norm(selectedRange);
  if (key) {
    return key;
  }
  return `${startTime.slice(0, 10)}_to_${subtractOneDay(endTime.slice(0, 10))}`;
}

export function DateRangeFilter({
  selectedRange,
  specificDate = null,
  onDateRangeChange,
  onSpecificDateSelect,
  masterDataStore,
  onInferenceImageSelect,
  graphData = [],
}: DateRangeFilterProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedInferenceFileName, setSelectedInferenceFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  void masterDataStore;

  useEffect(() => {
    if (specificDate) {
      setSelectedDate(specificDate);
    }
  }, [specificDate]);

  const handleRangeChange = (range: string) => {
    if (range === "specificDate") {
      const nextDate = selectedDate ?? new Date();
      setSelectedDate(nextDate);
      setIsCalendarOpen(true);
      onSpecificDateSelect(nextDate);
      return;
    }

    onDateRangeChange(range);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
      onSpecificDateSelect(date);
    }
  };

  const handleExport = async (format: "csv" | "json" | "pdf") => { //exporing data into json,CSV, or pdf
    const exportDate = specificDate ?? selectedDate ?? new Date();
    const information = computeRange(norm(selectedRange), exportDate);

    let startTime: string;
    let endTime: string;
    if (information.mode === "single-day") {
      ({ startTime, endTime } = singleDayWindow(information.dayString));
    } else {
      startTime = information.startTime;
      endTime = information.endTime;
    }

    try {
      const [debrisRows, carrotRows] = await Promise.all([
        getDebrisBetweenDates(startTime, endTime),
        getCarrotsBetweenDates(startTime.replace(" ", "T"), endTime.replace(" ", "T")),
      ]);

      const detections = (debrisRows ?? []).filter((row: any) => inRange(row.time_stamp, startTime, endTime));
      const carrotsInRange = (carrotRows ?? []).filter((row: any) => inRange(row.time_stamp, startTime, endTime));
      const uniqueCarrots = uniqueBy(carrotsInRange, (row: any) => String(row.id));
      const materials = Array.from(
        new Set(detections.map((row: any) => row.debris_type || "unknown"))
      ).sort((a, b) => a.localeCompare(b));

      const rangeLabel = formatRangeLabel(selectedRange, specificDate, startTime, endTime);
      const filename = `foreign_material_detection_${makeExportSlug(
        selectedRange,
        specificDate,
        startTime,
        endTime,
      )}.${format}`;

      let content = "";
      let mimeType = "";

      switch (format) {
        case "csv": {
          let csv = "Timestamp,Material Type\n";
          detections.forEach((det: any) => {
            csv += `${normalizeTimestamp(det.time_stamp)},${det.debris_type || "unknown"}\n`;
          });
          content = csv;
          mimeType = "text/csv";
          break;
        }

        case "json":
          content = JSON.stringify(
            {
              range: {
                label: rangeLabel,
                selectedRange,
                start: startTime,
                end: endTime,
              },
              summary: {
                totalDetections: detections.length,
                carrotsProcessed: uniqueCarrots.length,
                uniqueMaterials: materials.length,
                daysWithActivity: new Set(
                  detections.map((det: any) => normalizeTimestamp(det.time_stamp).slice(0, 10))
                ).size,
              },
              detections,
            },
            null,
            2
          );
          mimeType = "application/json";
          break;

        case "pdf": {
          const doc = new jsPDF();

          doc.setFontSize(18);
          doc.text("Foreign Material Detection Report", 14, 18);

          doc.setFontSize(11);
          doc.text(`Range: ${rangeLabel}`, 14, 28);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

          doc.setFontSize(13);
          doc.text("Summary", 14, 48);

          autoTable(doc, {
            startY: 54,
            head: [["Metric", "Value"]],
            body: [
              ["Total Foreign Material Detections", String(detections.length)],
              ["Carrots Processed", String(uniqueCarrots.length)],
              ["Unique Material Types", String(materials.length)],
              [
                "Days With Foreign Material Activity",
                String(new Set(detections.map((det: any) => normalizeTimestamp(det.time_stamp).slice(0, 10))).size),
              ],
            ],
          });

          autoTable(doc, {
            startY: ((doc as any).lastAutoTable?.finalY || 70) + 12,
            head: [["Timestamp", "Material Type"]],
            body: detections.length
              ? detections.map((det: any) => [
                  normalizeTimestamp(det.time_stamp) || "N/A",
                  det.debris_type || "N/A",
                ])
              : [["No detections recorded", ""]],
            styles: {
              fontSize: 9,
              cellPadding: 3,
            },
            headStyles: {
              fillColor: [35, 35, 35],
            },
          });

          doc.save(filename);
          return;
        }
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("EXPORT FAILED:", err);
    }
  };

  const handleRunInferenceClick = () => {
    fileInputRef.current?.click();
  };

  const handleInferenceFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setSelectedInferenceFileName(file.name);
  onInferenceImageSelect?.(file);

  try {
    const result = await runModelInference(file);
    alert("Inference result: " + JSON.stringify(result));
  } catch (err) {
    alert("Inference failed: " + err);
  }

  event.target.value = "";
};
  void selectedInferenceFileName;
  void handleRunInferenceClick;
  void handleInferenceFileChange;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Data Controls
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label>Time Range</label>
          <Select value={selectedRange} onValueChange={handleRangeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="last3months">Last 3 Months</SelectItem>
              <SelectItem value="thisyear">This Year</SelectItem>
              <SelectItem value="specificDate">Specific Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-2">
          <label className="text-sm font-medium">View Specific Date</label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarDays className="h-4 w-4 mr-2" />
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Export Format</label>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport("csv")}
              className="justify-start"
              size="sm"
            >
              <Table className="h-4 w-4 mr-2" />
              CSV
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExport("json")}
              className="justify-start"
              size="sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              JSON
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExport("pdf")}
              className="justify-start"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        <Separator />


      </CardContent>
    </Card>
  );
}
