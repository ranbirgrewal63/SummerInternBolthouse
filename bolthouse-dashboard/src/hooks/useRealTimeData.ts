import { useState, useEffect, useCallback } from 'react';
import { getLatestDetections, getModelStatus, LatestDetectionsResponse } from '../api/realtime';
import { getAllCarrots } from '../api/carrots';
import { getAllDebris } from '../api/debris';

export interface RealTimeData {
  latestDetections: LatestDetectionsResponse | null;
  modelStatus: {model_loaded: boolean, status: string} | null;
  totalCarrots: number;
  totalDebris: number;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useRealTimeData(pollingInterval: number = 3000) {
  const [data, setData] = useState<RealTimeData>({
    latestDetections: null,
    modelStatus: null,
    totalCarrots: 0,
    totalDebris: 0,
    lastUpdated: null,
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      const [latestDetections, modelStatus, carrots, debris] = await Promise.all([
        getLatestDetections(20),
        getModelStatus(),
        getAllCarrots(),
        getAllDebris(),
      ]);

      setData({
        latestDetections,
        modelStatus,
        totalCarrots: carrots.length,
        totalDebris: debris.length,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling
    const interval = setInterval(fetchData, pollingInterval);

    return () => clearInterval(interval);
  }, [fetchData, pollingInterval]);

  return { ...data, refetch: fetchData };
}