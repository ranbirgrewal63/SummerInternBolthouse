import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { API_BASE_URL } from "../api/config";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";

interface DetectionData {
  time: string;
  rangeLabel?: string;
  detections: number;
  processed: number;
}

interface DetectionChartProps {
  data: DetectionData[];
  specificDate?: Date | null;
}

const renderDotIfPositive =
  (key: "detections" | "processed") =>
  (props: any) => {
    const value = props.payload?.[key];
    if (typeof value !== "number" || value <= 0) return <></>;

    const fill = key === "detections" ? "#ef4444" : "#3b82f6";
    return <Dot {...props} r={4} strokeWidth={2} fill={fill} />;
  };

export function DetectionChart({ data, specificDate }: DetectionChartProps) {
  const [systemEnabled, setSystemEnabled] = useState<boolean | null>(null);
  const [feedUnavailable, setFeedUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (typeof fetch !== "function") {
      setSystemEnabled(true);
      return () => {
        cancelled = true;
      };
    }

    const loadPowerState = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/power/state`);
        const payload = await response.json();
        if (!cancelled) {
          setSystemEnabled(Boolean(payload.enabled));
        }
      } catch {
        if (!cancelled) {
          setSystemEnabled(true);
        }
      }
    };

    void loadPowerState();
    const intervalId = window.setInterval(() => {
      void loadPowerState();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const getTitle = () => {
    if (specificDate) {
      return `Hourly Detection Trends - ${specificDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`;
    }
    return "Detection Trends";
  };

  const getDescription = () => {
    if (specificDate) {
      return "Hour-by-hour breakdown of foreign material detections and carrot processing";
    }
    return "Foreign material detections and carrot processing over time";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">{getTitle()}</CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 font-medium text-foreground">Line Graph View</h4>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" type="category" allowDuplicatedCategory={false} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === "detections" ? "Foreign Materials" : "Carrots Processed",
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0 && payload[0].payload.rangeLabel) {
                        return `Time: ${payload[0].payload.rangeLabel}`;
                      }
                      return `Time: ${label}`;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="detections"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={renderDotIfPositive("detections")}
                    name="detections"
                  />
                  <Line
                    type="monotone"
                    dataKey="processed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={renderDotIfPositive("processed")}
                    name="processed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-medium text-foreground">Live Camera Feed</h4>
            <div className="overflow-hidden rounded-lg border bg-black">
              <div className="aspect-video">
                {systemEnabled === null ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/75">
                    Loading live feed status...
                  </div>
                ) : systemEnabled ? (
                  <img
                    src={`${API_BASE_URL}/video-feed`}
                    alt="Live camera feed"
                    className="h-full w-full object-contain"
                    onLoad={() => setFeedUnavailable(false)}
                    onError={() => setFeedUnavailable(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/75">
                    System power is off. Turn the system on to view the live feed.
                  </div>
                )}
              </div>
              <div className="border-t bg-card px-4 py-3 text-sm text-muted-foreground">
                {feedUnavailable
                  ? "Live stream unavailable right now. Check the backend camera stream."
                  : "Real-time annotated conveyor feed from the backend camera stream."}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}