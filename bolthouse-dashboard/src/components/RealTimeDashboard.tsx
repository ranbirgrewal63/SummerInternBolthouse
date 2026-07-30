import { useState } from 'react';
import { useRealTimeData } from '../hooks/useRealTimeData';
import { DashboardHeader } from './DashboardHeader';
import { DetectionChartContainer } from './DetectionChartContainer';
import { MetricsCardsContainer } from './MetricsCardsContainer';
import { DateRangeFilter } from './DateRangeFilter';
import { DetailedMaterialLogContainer } from './DetailedMaterialLogContainer';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { AccountUser } from '../api/auth';


export function RealTimeDashboard() {
  const {
    latestDetections,
    modelStatus,
    totalCarrots,
    totalDebris,
    lastUpdated,
    isLoading,
    error,
  } = useRealTimeData(3000);

  const [selectedRange, setSelectedRange] = useState("today");
  const [specificDate, setSpecificDate] = useState<Date | null>(null);
  const [refreshKey] = useState(0);

  // THIS KIND OF LOGIC IS DONE IN DateRangeFilter.tsx
  // const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // const [isUploading, setIsUploading] = useState(false);
  // const [uploadResult, setUploadResult] = useState<any>(null);
  // const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDateRangeChange = (range: string) => {
    setSelectedRange(range);
    setSpecificDate(null);
  };

  const handleSpecificDateSelect = (date: Date | null) => {
    setSpecificDate(date);
    setSelectedRange("specificDate");
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemStatus = modelStatus?.model_loaded ? 'online' : 'offline';
  const guestUser: AccountUser = {
    id: 0,
    full_name: "Worker",
    username: "guest",
    email: "",
    role: "guest",
    status: "approved",
    created_at: "",
  };

  const formatDebrisLabel = (value?: string) => {
    if (!value) return "Unknown";
    if (value.toLowerCase() === "foreign_material") {
      return "Foreign Material";
    }
    return value.replace(/_/g, " ");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        currentDate={currentDate}
        systemStatus={systemStatus}
        user={guestUser}
        onLogout={() => {}}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Model Status</CardTitle>
              {modelStatus?.model_loaded ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Badge variant={modelStatus?.model_loaded ? "default" : "destructive"}>
                  {modelStatus?.status || 'Unknown'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Carrots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalCarrots}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debris</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalDebris}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Updating...' : 'Auto-refresh: 3s'}
              </p>
            </CardContent>
          </Card>
        </div>

        <MetricsCardsContainer
          selectedRange={selectedRange}
          specificDate={specificDate}
          refreshKey={refreshKey}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DetectionChartContainer
              selectedRange={selectedRange}
              specificDate={specificDate}
              refreshKey={refreshKey}
            />
          </div>

          <div className="space-y-6">
            <DateRangeFilter
              selectedRange={selectedRange}
              specificDate={specificDate}
              onDateRangeChange={handleDateRangeChange}
              onSpecificDateSelect={handleSpecificDateSelect}
              masterDataStore={new Map()}
            />

          </div>
        </div>

        <DetailedMaterialLogContainer
          selectedRange={selectedRange}
          specificDate={specificDate}
          refreshKey={refreshKey}
        />

        <Card>
          <CardHeader>
            <CardTitle>Latest Detections (Real-time)</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-red-600">Error: {error}</div>
            ) : latestDetections?.data.length ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {latestDetections.data.map((detection, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={detection.type === 'carrot' ? 'default' : 'destructive'}>
                        {detection.type}
                      </Badge>
                      <span className="font-medium">
                        {detection.type === 'carrot' ? 'Carrot' : formatDebrisLabel(detection.debris_type)}
                      </span>
                      {detection.type === 'carrot' && (detection.length || detection.diameter) && (
                        <span className="text-sm text-gray-500">
                          {detection.length && `L: ${detection.length}"`}
                          {detection.length && detection.diameter && ' | '}
                          {detection.diameter && `D: ${detection.diameter}"`}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(detection.time_stamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                {isLoading ? 'Loading detections...' : 'No detections found'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
