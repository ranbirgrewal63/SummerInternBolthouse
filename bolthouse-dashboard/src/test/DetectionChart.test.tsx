// Run: npx vitest run src/test/DetectionChart.test.tsx
// Expected: PASS — DetectionChart correctly renders titles and chart sections from props

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { DetectionChart } from "../components/DetectionChart";

// Mock recharts entirely — its SVG rendering crashes in jsdom
vi.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Dot: () => null,
}));

vi.mock("../api/config", () => ({
  API_BASE_URL: "http://127.0.0.1:8001",
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({ enabled: true }),
    })),
  );
});

const mockData = [
  { time: "08:00", detections: 2, processed: 10 },
  { time: "09:00", detections: 0, processed: 15 },
  { time: "10:00", detections: 1, processed: 12 },
];

describe("DetectionChart", () => {
  it("renders the default title when no specific date is provided", () => {
    render(<DetectionChart data={mockData} />);
    expect(screen.getByText("Detection Trends")).toBeInTheDocument();
  });

  it("renders a date-specific title when specificDate is provided", () => {
    const date = new Date(2026, 3, 24); // April 24 2026
    render(<DetectionChart data={mockData} specificDate={date} />);
    expect(screen.getByText(/Hourly Detection Trends/i)).toBeInTheDocument();
  });

  it("renders both Line Graph View and Live Camera Feed sections", async () => {
    render(<DetectionChart data={mockData} />);
    expect(screen.getByText("Line Graph View")).toBeInTheDocument();
    expect(screen.getByText("Live Camera Feed")).toBeInTheDocument();
    expect(await screen.findByAltText("Live camera feed")).toBeInTheDocument();
  });

  it("renders without crashing when given empty data", () => {
    render(<DetectionChart data={[]} />);
    expect(screen.getByText("Detection Trends")).toBeInTheDocument();
  });
});
