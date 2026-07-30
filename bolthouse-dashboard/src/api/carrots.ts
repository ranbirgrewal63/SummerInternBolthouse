import { apiGet, apiPost, apiDelete, normalizeDateParam } from "./http";
import { CarrotRecord } from "./types";
export type { CarrotRecord };

export async function getAllCarrots(): Promise<CarrotRecord[]> {
  const data = await apiGet<{ count: number, data: CarrotRecord[] }>(`/db/carrots`);
  return data.data;
}

export async function getCarrotsByDate(date: string): Promise<CarrotRecord[]> {
  const data = await apiGet<{ count: number, data: CarrotRecord[] }>(`/db/carrots/by-date?date=${encodeURIComponent(date)}`);
  return data.data;
}

export async function addCarrots(params: { time_stamp: string, length?: number, diameter?: number }): Promise<{ message: string }> {
  const search = new URLSearchParams();
  search.set("time_stamp", normalizeDateParam(params.time_stamp));
  if (params.length !== undefined) search.set("length", String(params.length));
  if (params.diameter !== undefined) search.set("diameter", String(params.diameter));
  return apiPost<{ message: string }>(`/db/carrots?${search.toString()}`);
}

export async function deleteCarrotsByDate(date: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/db/carrots?date=${encodeURIComponent(date)}`);
}

export async function deleteCarrotsBefore(date: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/db/carrots?before=${encodeURIComponent(date)}`);
}

export async function deleteCarrotsAfter(date: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/db/carrots?after=${encodeURIComponent(date)}`);
}

export async function deleteCarrotsBetween(startTime: string, endTime: string): Promise<{ message: string }> {
  const search = new URLSearchParams();
  search.set("start", normalizeDateParam(startTime));
  search.set("end", normalizeDateParam(endTime));
  return apiDelete<{ message: string }>(`/db/carrots?${search.toString()}`);
}

export async function getCarrotsBetweenDates(start: string, end: string): Promise<CarrotRecord[]> {
  const search = new URLSearchParams();
  search.set("start", normalizeDateParam(start));
  search.set("end", normalizeDateParam(end));
  const data = await apiGet<{ count: number, data: CarrotRecord[] }>(`/db/carrots/range?${search.toString()}`);
  return data.data;
}

