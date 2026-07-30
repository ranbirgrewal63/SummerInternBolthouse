import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { ChevronDown, ChevronRight, Calendar, AlertTriangle, Image as ImageIcon, Trash2 } from "lucide-react";
import { API_BASE_URL } from "../api/config";

interface DailyDetection {
  id: string;
  eventId?: string;
  timestamp: string;
  material: string;
  severity: "low" | "medium" | "high";
  imageId?: string;
}

interface DailyMaterialLog {
  date: string;
  totalDetections: number;
  detections: DailyDetection[];
}

interface DetailedMaterialLogProps {
  materialLogs: DailyMaterialLog[];
  selectedRange: string;
  specificDate?: Date | null;
  onDeleteDetection?: (target: {
    id: string;
    eventId: string;
    material: string;
  }) => void;
}

export function DetailedMaterialLog({ materialLogs, selectedRange, specificDate, onDeleteDetection }: DetailedMaterialLogProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const formatMaterialLabel = (material: string) => {
    if ((material || "").toLowerCase() === "foreign_material") {
      return "Foreign Material";
    }
    return material.replace(/_/g, " ");
  };

  const setDayOpen = (date: string, open: boolean) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (open) {
        next.add(date);
      } else {
        next.delete(date);
      }
      return next;
    });
  };

  const getSeverityBadge = (severity: DailyDetection['severity']) => {
    const variants = {
      low: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      medium: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
      high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
    };

    return (
      <Badge className={variants[severity]}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getTotalMaterials = () => {
    return materialLogs.reduce((total, day) => total + day.totalDetections, 0);
  };

  const getUniqueMaterials = () => {
    const materials = new Set<string>();
    materialLogs.forEach(day => {
      day.detections.forEach(detection => {
        materials.add(detection.material);
      });
    });
    return materials.size;
  };

  const getRangeLabel = () => {
    if (specificDate) {
      return specificDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    switch (selectedRange) {
      case "today": return "Today";
      case "last7days": return "Last 7 Days";
      case "last30days": return "Last 30 Days";
      case "last3months": return "Last 3 Months";
      case "last6months": return "Last 6 Months";
      case "lastyear": return "Last Year (Full Calendar Year)";
      case "thisMonth": return "This Month";
      case "thisYear": return "This Year";
      default: return selectedRange;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Detailed Material Detection Log
        </CardTitle>
        <CardDescription className="text-[20px] text-primary">
          Daily breakdown of all foreign materials detected - {getRangeLabel()}
        </CardDescription>
        <div className="flex gap-4 pt-2">
          <div className="text-sm">
            <span className="font-medium">Total Detections:</span> {getTotalMaterials()}
          </div>
          <div className="text-sm">
            <span className="font-medium">Unique Materials:</span> {getUniqueMaterials()}
          </div>
          <div className="text-sm">
            <span className="font-medium">Days with Activity:</span> {materialLogs.length}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {materialLogs.map((dayLog) => (
            <Collapsible
              key={dayLog.date}
              open={expandedDays.has(dayLog.date)}
              onOpenChange={(open) => setDayOpen(dayLog.date, open)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto border rounded-lg hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    {expandedDays.has(dayLog.date) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div className="text-left">
                      <div className="font-medium">{dayLog.date}</div>
                      <div className="text-sm text-muted-foreground">
                        {dayLog.totalDetections} detection{dayLog.totalDetections !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dayLog.totalDetections > 5 && (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    )}
                    <Badge variant="outline">
                      {dayLog.totalDetections}
                    </Badge>
                  </div>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2">
                <div className="ml-7 space-y-2">
                  {dayLog.detections.map((detection) => (
                    <div
                      key={detection.id}
                      className="p-3 bg-muted/50 rounded-lg border-l-4 border-l-red-200"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatMaterialLabel(detection.material)}</span>
                            {detection.severity !== "low" && getSeverityBadge(detection.severity)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {detection.timestamp}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {detection.imageId && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  View Image
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle>Debris Detection Image</DialogTitle>
                                </DialogHeader>
                                <div className="mt-4">
                                  <img
                                    src={`${API_BASE_URL}/events/${detection.imageId}/snapshot`}
                                    alt={`Debris detection at ${detection.timestamp}`}
                                    className="w-full h-auto rounded-lg object-contain"
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {detection.eventId && onDeleteDetection && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this log entry?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove the <strong>{formatMaterialLabel(detection.material)}</strong> detection at {detection.timestamp}. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      onDeleteDetection({
                                        id: detection.id,
                                        eventId: detection.eventId!,
                                        material: detection.material,
                                      })
                                    }
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {materialLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No foreign material detections found for the selected time period.
            </div>
          )}

          {materialLogs.filter(log => log.totalDetections === 0).length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-900">
              <div className="text-sm text-green-800 dark:text-green-300">
                <strong>Clean Days:</strong> {materialLogs.filter(log => log.totalDetections === 0).length} day(s) with no foreign material detected
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
