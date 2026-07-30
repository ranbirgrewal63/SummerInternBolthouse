import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, AlertCircle } from "lucide-react";

interface MetricsCardsProps {
  todayDetections: number;
  totalProcessed: number;
  selectedRange?: string;
}

export function MetricsCards({
  todayDetections,
  totalProcessed,
  selectedRange = "today"
}: MetricsCardsProps) {

  // Get appropriate labels based on selected range
  const getDetectionLabel = () => {
    switch (selectedRange) {
      case "today": return "Today's Detections";
      case "yesterday": return "Yesterday's Detections";
      case "last7days": return "7-Day Detections";
      case "last30days": return "30-Day Detections";
      case "last3months": return "3-Month Detections";
      case "last6months": return "6-Month Detections";
      case "lastyear": return "Last Year Detections";
      case "thisYear": return "This Year Detections";
      case "specificDate": return "Daily Detections";
      default: return "Detections";
    }
  };

  const getProcessedLabel = () => {
    switch (selectedRange) {
      case "today": return "Total today";
      case "yesterday": return "Total yesterday";
      case "last7days": return "Total 7 days";
      case "last30days": return "Total 30 days";
      case "last3months": return "Total 3 months";
      case "last6months": return "Total 6 months";
      case "lastyear": return "Total last year";
      case "thisYear": return "Total this year";
      case "specificDate": return "Total for day";
      default: return "Total processed";
    }
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{getDetectionLabel()}</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayDetections}</div>
          <p className="text-xs text-muted-foreground">Foreign materials detected</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Carrots Processed</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProcessed.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">{getProcessedLabel()}</p>
        </CardContent>
      </Card>
    </div>
  );
}