"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface PricePoint {
  base: string;
  quote: string;
  bid: number;
  ask: number;
  midpoint: number;
  spread: number;
  timestamp: string;
  direction: "up" | "down" | "flat";
  change: number;
  changePct: number;
}

interface UseRealtimePricesReturn {
  prices: PricePoint[];
  mainPair: PricePoint | null;
  isConnected: boolean;
  lastUpdate: Date | null;
  refresh: () => void;
}

export function useRealtimePrices(intervalMs: number = 5000): UseRealtimePricesReturn {
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [mainPair, setMainPair] = useState<PricePoint | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const prevPrices = useRef<Map<string, number>>(new Map());

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      const data = await res.json();
      if (!data.success) throw new Error("Failed");

      const newPrices: PricePoint[] = (data.pairs || []).map((p: any) => {
        const key = `${p.base}${p.quote}`;
        const prev = prevPrices.current.get(key) || p.midpoint;
        const change = p.midpoint - prev;
        const changePct = prev > 0 ? (change / prev) * 100 : 0;
        prevPrices.current.set(key, p.midpoint);
        return {
          ...p,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          change,
          changePct,
        };
      });

      setPrices(newPrices);
      if (data.main) {
        const key = `${data.main.base}${data.main.quote}`;
        const prev = prevPrices.current.get(key) || data.main.midpoint;
        const change = data.main.midpoint - prev;
        prevPrices.current.set(key, data.main.midpoint);
        setMainPair({
          ...data.main,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          change,
          changePct: prev > 0 ? (change / prev) * 100 : 0,
        });
      }
      setIsConnected(true);
      setLastUpdate(new Date());
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, intervalMs);
    return () => clearInterval(interval);
  }, [fetchPrices, intervalMs]);

  return { prices, mainPair, isConnected, lastUpdate, refresh: fetchPrices };
}
