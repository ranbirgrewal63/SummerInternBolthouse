import { useState, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { API_BASE_URL } from "../api/config";

type FieldOption = {
  j_code: string;
  field_name: string;
};

export function FieldSelector() {
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [currentJCode, setCurrentJCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    try {
      const [fieldsRes, currentRes] = await Promise.all([
        fetch(`${API_BASE_URL}/fields`),
        fetch(`${API_BASE_URL}/fields/current`),
      ]);

      if (!fieldsRes.ok || !currentRes.ok) {
        throw new Error("Failed to load fields");
      }

      const fieldsData = await fieldsRes.json();
      const currentData = await currentRes.json();

      setFields(fieldsData.fields ?? []);
      setCurrentJCode(currentData.j_code ?? null);
      setError(null);
    } catch {
      setError("Couldn't load field list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const handleChange = async (jCode: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/fields/current/${encodeURIComponent(jCode)}`,
        { method: "POST" }
      );
      if (!response.ok) {
        throw new Error("Failed to set field");
      }
      setCurrentJCode(jCode);
    } catch {
      setError("Couldn't switch field");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading fields...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-blue-400 shrink-0" />
      <div className="flex flex-col">
        <label htmlFor="field-select" className="sr-only">
          Current field
        </label>
        <select
          id="field-select"
          value={currentJCode ?? ""}
          disabled={saving || fields.length === 0}
          onChange={(e) => void handleChange(e.target.value)}
          className="bg-gray-800 text-white text-sm border border-gray-600 rounded-md px-3 py-1.5
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="" disabled>
            Select field...
          </option>
          {fields.map((field) => (
            <option key={field.j_code} value={field.j_code}>
              {field.field_name} ({field.j_code})
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-red-400 mt-0.5">{error}</span>
        )}
      </div>
    </div>
  );
}