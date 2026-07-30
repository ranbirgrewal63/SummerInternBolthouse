// Run: npx vitest run src/test/StatusPanel.test.tsx
// Expected: FAIL — StatusPanel shows static text only, not real-time status indicators

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatusPanel from "../components/StatusPanel";

describe("StatusPanel", () => {
  it("renders the Status Panel heading", () => {
    render(<StatusPanel />);
    expect(screen.getByText("Status Panel")).toBeInTheDocument();
  });

  // FAIL: component shows static "Idle" text, not a real database connection indicator
  it("displays database connection status", () => {
    render(<StatusPanel />);
    expect(screen.getByText(/database.*connected/i)).toBeInTheDocument();
  });

  // FAIL: component shows static "Waiting" text, not a real system online indicator
  it("displays system online status", () => {
    render(<StatusPanel />);
    expect(screen.getByText(/system.*online/i)).toBeInTheDocument();
  });

  // FAIL: component has no internet connection indicator at all
  it("displays internet connection status", () => {
    render(<StatusPanel />);
    expect(screen.getByText(/internet.*connected/i)).toBeInTheDocument();
  });
});
