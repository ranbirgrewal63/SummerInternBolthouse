import { apiGet } from "./http";

export interface LatestDetection {
  time_stamp: string;
  type: "carrot" | "debris";
  length?: number | null;
  diameter?: number | null;
  debris_type?: string;
}

export interface LatestDetectionsResponse {
  count: number;
  data: LatestDetection[];
  carrots_count: number;
  debris_count: number;
}

export interface LiveFeedStats {
  active_detections: number;
  foreign_objects_per_minute: number;
  stream_connected: boolean;
  last_frame_timestamp: number | null;
}

export async function getLatestDetections(limit: number = 20): Promise<LatestDetectionsResponse> {
  return apiGet<LatestDetectionsResponse>(`/db/latest?limit=${limit}`);
}

export async function getModelStatus(): Promise<{ model_loaded: boolean, status: string }> {
  return apiGet<{ model_loaded: boolean, status: string }>("/model/status");
}

export async function getLiveFeedStats(): Promise<LiveFeedStats> {
  return apiGet<LiveFeedStats>("/video-feed-stats");
}
