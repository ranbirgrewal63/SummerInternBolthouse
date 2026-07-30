import { apiGet, apiPost, apiDelete, normalizeDateParam } from "./http";
import { DebrisRecord } from "./types";
export type { DebrisRecord };

export async function getAllDebris(): Promise<DebrisRecord[]> {
  const data = await apiGet<{ count: number, data: DebrisRecord[] }>("/db/debris");
  return data.data;
}

export async function getDebrisByDate(date: string): Promise<DebrisRecord[]> {
  const data = await apiGet<{ count: number, data: DebrisRecord[] }>(`/db/debris/by-date?date=${encodeURIComponent(date)}`);
  return data.data;
}

export async function getDebrisByType(type: string): Promise<DebrisRecord[]> {
  const data = await apiGet<{ count: number, data: DebrisRecord[] }>(`/db/debris/by-type?debris_type=${encodeURIComponent(type)}`);
  return data.data;
}

export async function addDebris(params: { time_stamp: string; debris_type: string; }): Promise<{ message: string }> {
  const search = new URLSearchParams();
  search.set("time_stamp", normalizeDateParam(params.time_stamp));
  search.set("debris_type", params.debris_type);
  return apiPost<{ message: string }>(`/db/debris?${search.toString()}`);
}

export async function deleteDebrisOnDate(date: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/db/debris?date=${encodeURIComponent(date)}`);
}

export async function deleteDebrisBefore(date: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/db/debris?before=${encodeURIComponent(date)}`);
}

export async function deleteDebrisAfter(date: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/db/debris?after=${encodeURIComponent(date)}`);
}

export async function deleteDebrisBetween(startTime: string, endTime: string): Promise<{ message: string }> {
  const search = new URLSearchParams();
  search.set("start", normalizeDateParam(startTime));
  search.set("end", normalizeDateParam(endTime));
  return apiDelete<{ message: string }>(`/db/debris?${search.toString()}`);
}

export async function getDebrisBetweenDates(startTime: string, endTime: string): Promise<DebrisRecord[]> {
  const search = new URLSearchParams();
  search.set("start", normalizeDateParam(startTime));
  search.set("end", normalizeDateParam(endTime));
  const data = await apiGet<{ count: number, data: DebrisRecord[] }>(`/db/debris/range?${search.toString()}`);
  return data.data;
}

export async function deleteDebrisDetection(
  eventId: string,
  debrisType: string,
): Promise<{ message: string }> {
  const search = new URLSearchParams();
  search.set("debris_type", debrisType);

  try {
    return await apiDelete<{ message: string }>(
      `/events/${eventId}/debris?${search.toString()}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Method Not Allowed")) {
      return apiPost<{ message: string }>(
        `/events/${eventId}/debris?${search.toString()}`
      );
    }
    throw error;
  }
}
