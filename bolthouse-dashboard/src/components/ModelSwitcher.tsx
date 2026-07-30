import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Cpu } from "lucide-react";
import { API_BASE_URL } from "../api/config";

type ModelName = "light" | "medium" | "heavy";

interface ModelInfo {
  name: ModelName;
  description: string;
  confidence: number;
  active: boolean;
  has_own_weights: boolean;
}

const MODEL_COLORS: Record<ModelName, string> = {
  light:  "bg-blue-500 text-white",
  medium: "bg-yellow-500 text-white",
  heavy:  "bg-red-500 text-white",
};

interface ModelSwitcherProps {
  disabled?: boolean;
}

export function ModelSwitcher({ disabled = false }: ModelSwitcherProps) {
  const [models, setModels]   = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModels = async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/model/list`);
      const data = await res.json();
      setModels(data);
    } catch {
      // backend not reachable — silent fail
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const switchModel = async (name: ModelName) => {
    if (disabled) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/model/set/${name}`, { method: "POST" });
      await fetchModels();
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const active = models.find((m) => m.active);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-muted rounded-lg border dark:border-border">
      <Cpu className="h-5 w-5 text-purple-500" />
      <span className="text-sm font-medium">Model:</span>

      {active && (
        <Badge className={MODEL_COLORS[active.name]}>
          {active.name.charAt(0).toUpperCase() + active.name.slice(1)}
        </Badge>
      )}

      <div className="flex gap-1">
        {(["light", "medium", "heavy"] as ModelName[]).map((name) => {
          const info     = models.find((m) => m.name === name);
          const isActive = info?.active ?? false;
          const hasOwn   = info?.has_own_weights ?? false;

          return (
            <Button
              key={name}
              size="sm"
              variant={isActive ? "default" : "outline"}
              disabled={disabled || loading || isActive}
              onClick={() => switchModel(name)}
              className="h-7 px-2 text-xs"
              title={
                info
                  ? `${info.description}${hasOwn ? "" : " (using default weights)"}`
                  : name
              }
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
              {/* Small dot indicator — green if dedicated weights exist, gray if using fallback */}
              <span
                className="ml-1 inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: hasOwn ? "#22c55e" : "#94a3b8" }}
                title={hasOwn ? "Dedicated weights loaded" : "Using default weights"}
              />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
