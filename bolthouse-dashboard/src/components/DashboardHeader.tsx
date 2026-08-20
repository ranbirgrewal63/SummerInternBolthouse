import { useState, useEffect } from "react";
import { Calendar, Shield, Power, LogOut } from "lucide-react";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { LiveCameraModal } from "./LiveCameraModal";
import { HardwareConfigModal } from "./HardwareConfigModal";
import { ModeToggle } from "./mode-toggle";
import { API_BASE_URL } from "../api/config";
import { AccountUser } from "../api/auth";
import { FieldSelector } from "./FieldSelector";

import { CarrotsCalendar } from "./CarrotsCalendar";
interface DashboardHeaderProps {
  currentDate: string;
  systemStatus: "online" | "offline" | "warning";
  user: AccountUser;
  onLogout: () => void;
}

export function DashboardHeader({
  currentDate,
  systemStatus,
  user,
  onLogout,
}: DashboardHeaderProps) {
  const [systemEnabled, setSystemEnabled] = useState<boolean | null>(null);

  const role = user.role;
  const canControlPower = role === "administrator" || role === "operator";
  const canUseLiveCameraDebug = role === "administrator" || role === "operator";

  // Fetch the persisted power state from the backend when the component mounts.
  // useState starts as null so the toggle waits for the DB value before rendering.
  useEffect(() => {
    fetch(`${API_BASE_URL}/power/state`)
      .then((res) => res.json())
      .then((data) => setSystemEnabled(data.enabled))
      .catch(() => setSystemEnabled(true)); // fallback to ON if backend unreachable
  }, []);

  const handlePowerChange = async (checked: boolean) => {
    if (!canControlPower) return;
    setSystemEnabled(checked);
  
    try {
      await fetch(`${API_BASE_URL}/power/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
    } catch {
      setSystemEnabled(!checked);
    }
  };

  // Show nothing until DB state is loaded
  if (systemEnabled === null) return null;

  const getStatusBadge = () => {
    if (!systemEnabled) {
      return <Badge className="bg-gray-500 text-white">System Off</Badge>;
    }

    switch (systemStatus) {
      case "online":
        return <Badge className="bg-green-500 text-white">Online</Badge>;
      case "offline":
        return <Badge className="bg-red-500 text-white">Offline</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500 text-white">Warning</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">Unknown</Badge>;
    }
  };

  return (
    <div className="flex justify-between items-center p-6 bg-white dark:bg-card border-b dark:border-border">
      <div>
        <h1 className="mb-2">Foreign Material Detection System</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {currentDate}
        </p>
      </div>
  
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border">
          <Power className={`h-5 w-5 ${systemEnabled ? "text-green-500" : "text-gray-400"}`} />
          <span className="text-sm font-medium">System Power</span>

          <Switch
            checked={systemEnabled}
            onCheckedChange={handlePowerChange}
            disabled={!canControlPower}
          />

          <span className="text-sm font-medium">{systemEnabled ? "ON" : "OFF"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <span>Role:</span>
          <Badge variant="outline">
            {role === "administrator" ? "Administrator" : role === "operator" ? "Operator" : "Worker"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <span>Status:</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          <FieldSelector />
        </div>
        {canUseLiveCameraDebug && <LiveCameraModal systemEnabled={systemEnabled} />}
        <HardwareConfigModal />
        <ModeToggle />

        <Button variant="outline" onClick={onLogout} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
        
      </div>
    </div>
  );
}
