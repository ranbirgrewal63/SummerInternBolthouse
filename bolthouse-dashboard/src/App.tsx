import { useMemo, useState, useEffect } from "react";
import { DashboardHeader } from "./components/DashboardHeader";
import { DetectionChartContainer, type DetectionData } from "./components/DetectionChartContainer";
import { DateRangeFilter } from "./components/DateRangeFilter";
import { MetricsCardsContainer } from "./components/MetricsCardsContainer";
import { DetailedMaterialLogContainer } from "./components/DetailedMaterialLogContainer";
import { ThemeProvider } from "./components/theme-provider";
import { LoginPage } from "./components/LoginPage";
import { ForeignObjectAlert } from "./components/ForeignObjectAlert";
import { AccountManagementPanel } from "./components/AccountManagementPanel";
import { AccountUser } from "./api/auth";

// Master data store - generates consistent data for the past year
// Kept for DateRangeFilter export functionality
const generateMasterDataStore = () => {
  const now = new Date();
  const masterStore = new Map();

  // Ensure we have data for the full previous calendar year (2024)
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;
  const startOfLastYear = new Date(lastYear, 0, 1);

  // Calculate days needed to cover from start of last year to today
  const daysNeeded = Math.ceil((now.getTime() - startOfLastYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Generate data for enough days to cover the full previous calendar year
  for (let i = 0; i <= daysNeeded; i++) {
    const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
    const dateKey = date.toDateString();

    // Create deterministic but varied daily patterns using date as seed
    const seed = date.getTime() / 1000000; // Use date as seed for consistency

    // Create pseudo-random functions using the date seed
    const random1 = ((seed * 9301 + 49297) % 233280) / 233280;
    const random2 = ((seed * 9307 + 49297) % 233280) / 233280;

    // Generate varied daily patterns
    const weekdayFactor = [0.7, 0.9, 1.0, 1.0, 1.0, 0.8, 0.6][date.getDay()]; // Lower on weekends

    const dayData = {
      date: dateKey,
      dateObj: date,
      hourlyData: [] as any[],
      dailyDetections: 0,
      dailyProcessed: 0,
      materialDetections: [] as any[]
    };

    // Generate more realistic daily totals with variation
    const baseDailyDetections = Math.floor(15 + (random1 * 40)); // 15-55 detections per day
    const baseDailyProcessed = Math.floor(1500 + (random2 * 3000)) * weekdayFactor; // 1500-4500 carrots, lower on weekends

    // Generate hourly data for this day
    for (let hour = 0; hour < 24; hour++) {
      // Create hour-specific random values using date and hour
      const hourSeed = seed + hour * 1000;
      const hourRandom1 = ((hourSeed * 9301 + 49297) % 233280) / 233280;
      const hourRandom2 = ((hourSeed * 9307 + 49297) % 233280) / 233280;

      // Work shift patterns (higher activity during work hours)
      const workHourFactor = hour >= 6 && hour <= 22 ? 1.0 : 0.3;
      const peakHourFactor = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16) ? 1.3 : 1.0;

      // Calculate hourly detections and processing with realistic distribution
      const hourlyDetectionRate = (baseDailyDetections / 24) * workHourFactor * peakHourFactor;
      const detections = Math.max(0, Math.floor(hourlyDetectionRate + (hourRandom1 - 0.5) * 8));

      const hourlyProcessingRate = (baseDailyProcessed / 24) * workHourFactor * peakHourFactor;
      const processed = Math.max(0, Math.floor(hourlyProcessingRate + (hourRandom2 - 0.5) * 200));

      dayData.hourlyData.push({
        hour,
        detections,
        processed,
        timeString: `${hour.toString().padStart(2, '0')}:00`
      });

      dayData.dailyDetections += detections;
      dayData.dailyProcessed += processed;
    }

    masterStore.set(dateKey, dayData);
  }

  return masterStore;
};

export default function App() {
  const [selectedRange, setSelectedRange] = useState("today");
  const [specificDate, setSpecificDate] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentGraphData, setCurrentGraphData] = useState<DetectionData[]>([]);

  // NEW: auth + tier state
  const [user, setUser] = useState<AccountUser | null>(null);

  // Create master data store once using useMemo for consistency
  const masterDataStore = useMemo(() => generateMasterDataStore(), []);

  const handleDateRangeChange = (range: string) => {
    setSelectedRange(range);
    setSpecificDate(null); // Clear specific date when selecting a range
  };

  const handleSpecificDateSelect = (date: Date | null) => {
    setSpecificDate(date);
    setSelectedRange("specificDate"); // Clear range selection when viewing a specific date
  };

  const handleLogout = () => {
    setUser(null);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Show login page before dashboard
  if (!user) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <LoginPage onLogin={setUser} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-gray-50 dark:bg-background">
        <DashboardHeader
          currentDate={currentDate}
          systemStatus="online"
          user={user}
          onLogout={handleLogout}
        />
        <ForeignObjectAlert />

        <div className="p-6 space-y-6">
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
                onChartDataChange={setCurrentGraphData}
              />
            </div>

            <div className="space-y-6">
              <DateRangeFilter
                selectedRange={selectedRange}
                specificDate={specificDate}
                onDateRangeChange={handleDateRangeChange}
                onSpecificDateSelect={handleSpecificDateSelect}
                masterDataStore={masterDataStore}
                graphData={currentGraphData}
              />
            </div>
          </div>
          
          

          <DetailedMaterialLogContainer
            selectedRange={selectedRange}
            specificDate={specificDate}
            refreshKey={refreshKey}
          />
          {user.role === "administrator" && <AccountManagementPanel />}
        </div>
      </div>
    </ThemeProvider>
  );
}
