import { useState, useEffect } from "react";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { CalendarDays, Download, FileText, Table, AlertCircle, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getCarrotsBetweenDates } from "../api/carrots";
import { getDebrisBetweenDates } from "../api/debris";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DateExportSelectorProps {
  onDateSelect?: (date: Date) => void;
  onExportData?: (date: Date, format: 'csv' | 'json' | 'pdf') => void;
  masterDataStore?: Map<string, any>;
}

export function DateExportSelector({ onDateSelect, onExportData }: DateExportSelectorProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDateDataState, setSelectedDateDataState] = useState<any | null>(null);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
      onDateSelect?.(date);
    }
  };

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDateDataState(null);
      return;
    }

    const load = async () => {
      try {
        const y = selectedDate.getFullYear();
        const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const d = String(selectedDate.getDate()).padStart(2, "0");
        const dayStr = `${y}-${m}-${d}`;
        const start = `${dayStr} 00:00:00`;

        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 1);
        const y2 = next.getFullYear();
        const m2 = String(next.getMonth() + 1).padStart(2, "0");
        const d2 = String(next.getDate()).padStart(2, "0");
        const end = `${y2}-${m2}-${d2} 00:00:00`;

        const [debris, carrots] = await Promise.all([
          getDebrisBetweenDates(start, end),
          getCarrotsBetweenDates(start, end),
        ]);

        const toHour = (ts: string) => {
          const s = (ts || "").replace("T", " ");
          return s.slice(11, 13) + ":00";
        };

        const hourly: Record<string, { detections: number; processed: number }> = {};

        for (const dRec of debris as any[]) {
          const key = toHour(dRec.time_stamp);
          if (!hourly[key]) hourly[key] = { detections: 0, processed: 0 };
          hourly[key].detections += 1;
        }

        for (const cRec of carrots as any[]) {
          const key = toHour(cRec.time_stamp);
          if (!hourly[key]) hourly[key] = { detections: 0, processed: 0 };
          hourly[key].processed += 1;
        }

        const chartData = Object.keys(hourly)
          .sort()
          .map((time) => ({
            time,
            detections: hourly[time].detections,
            processed: hourly[time].processed,
          }));

        const materialDetections = [
          ...(debris as any[]).map((dRec) => ({
            timestamp: (dRec.time_stamp || "").replace("T", " "),
            material: dRec.debris_type,
            severity: "N/A",
          })),
          ...(carrots as any[]).map((cRec) => ({
            timestamp: (cRec.time_stamp || "").replace("T", " "),
            material: "carrot",
            severity: "N/A",
          })),
        ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        setSelectedDateDataState({
          chartData,
          totalDetections: (debris as any[]).length,
          totalProcessed: (carrots as any[]).length,
          materialDetections,
        });
      } catch (err) {
        console.error("Failed to load export data", err);
        setSelectedDateDataState(null);
      }
    };

    load();
  }, [selectedDate]);

  const getSelectedDateData = () => {
    return selectedDateDataState;
  };

  const selectedDateData = getSelectedDateData();

  const exportPdf = () => {
    if (!selectedDate || !selectedDateData) return;

    const dateStr = selectedDate.toLocaleDateString();
    const filenameDate = selectedDate.toISOString().split("T")[0];

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Foreign Material Detection Report", 14, 18);

    doc.setFontSize(11);
    doc.text(`Date: ${dateStr}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

    doc.setFontSize(13);
    doc.text("Daily Summary", 14, 48);

    autoTable(doc, {
      startY: 54,
      head: [["Metric", "Value"]],
      body: [
        ["Foreign Material Detections", String(selectedDateData.totalDetections || 0)],
        ["Carrots Processed", String(selectedDateData.totalProcessed || 0)],
      ],
    });

    const detections = selectedDateData.materialDetections || [];

    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 70) + 12,
      head: [["Timestamp", "Material Type", "Severity"]],
      body: detections.length
        ? detections.map((det: any) => [
            det.timestamp || "N/A",
            det.material || "N/A",
            det.severity || "N/A",
          ])
        : [["No detections recorded", "", ""]],
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [35, 35, 35],
      },
    });

    doc.save(`foreign_material_detection_${filenameDate}.pdf`);
  };


  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    if (selectedDate) {
      if (format !== "pdf") {
      onExportData?.(selectedDate, format);
      }

      // Simulate export download
      const dateStr = format === 'pdf' ?
        selectedDate.toLocaleDateString() :
        selectedDate.toISOString().split('T')[0];

      const filename = `foreign_material_detection_${dateStr.replace(/\//g, '-')}.${format}`;

      // Create mock data for download simulation
      let content = '';
      let mimeType = '';

      switch (format) {
        case 'csv':
          const csvDetections = selectedDateData?.materialDetections || [];
          const csvRows = csvDetections.map((det: { timestamp: any; material: any; severity: any; }) => `${dateStr},${det.timestamp},${det.material},${det.severity}`);
          content = `Date,Time,Material Type,Severity\n${csvRows.join('\n')}`;
          mimeType = 'text/csv';
          break;
        case 'json':
          content = JSON.stringify({
            date: dateStr,
            summary: {
              totalDetections: selectedDateData?.totalDetections || 0,
              carrotsProcessed: selectedDateData?.totalProcessed || 0
            },
            detections: selectedDateData?.materialDetections || []
          }, null, 2);
          mimeType = 'application/json';
          break;
        case 'pdf':
          exportPdf();
          return;
      }

      // Create and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Export Specific Date Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDate && selectedDateData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side - Daily Analytics */}
              <div className="lg:col-span-2 space-y-4">
                {/* Daily Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Daily Detections</CardTitle>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedDateData.totalDetections}</div>
                      <p className="text-xs text-muted-foreground">Foreign materials detected</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Carrots Processed</CardTitle>
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{selectedDateData.totalProcessed.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">Total for the day</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Detection Trends Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Hourly Detection Trends - {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedDateData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="time"
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                          Time
                                        </span>
                                        <span className="font-bold text-muted-foreground">
                                          {label}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                          Detections
                                        </span>
                                        <span className="font-bold">
                                          {payload[0].value}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="detections"
                            strokeWidth={2}
                            stroke="#ef4444"
                            dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: "#ef4444", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Side - Export Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Date:</label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {selectedDate ? selectedDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        }) : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        disabled={(date) => date > new Date() || date < new Date("2022-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">Selected Date</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {selectedDate.toDateString() === new Date().toDateString() ? "Today" : "Historical"}
                  </Badge>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Export Format:</label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleExport('csv')}
                      className="justify-start"
                    >
                      <Table className="h-4 w-4 mr-2" />
                      Export as CSV
                      <Badge variant="secondary" className="ml-auto">
                        Spreadsheet
                      </Badge>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExport('json')}
                      className="justify-start"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export as JSON
                      <Badge variant="secondary" className="ml-auto">
                        Data
                      </Badge>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExport('pdf')}
                      className="justify-start"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export as PDF
                      <Badge variant="secondary" className="ml-auto">
                        Report
                      </Badge>
                    </Button>
                  </div>
                </div>

                {/* Preview of data available */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-1">
                    Data Preview
                  </div>
                  <div className="text-xs text-blue-700 space-y-1">
                    <div>• Foreign material detections with timestamps</div>
                    <div>• Material types and severity levels</div>
                    <div>• Processing statistics and efficiency metrics</div>
                    <div>• Camera status and system health data</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Date:</label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full max-w-sm justify-start">
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {selectedDate ? selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date > new Date() || date < new Date("2022-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Select a date to view detailed analytics and export options
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
