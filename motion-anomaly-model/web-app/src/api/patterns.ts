import { api } from './client';
import type { Report } from './reports';

export type Patterns = {
  generatedAt: number;
  totalReports: number;
  deltas: {
    reportsLastWeek: number;
    reportsLastWeekDelta: number;
    severeLastWeek: number;
    severeLastWeekDelta: number;
  };
  timeBuckets: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
    unknown: number;
  };
  topLocations: { lat: number; lng: number; count: number }[];
  topCategories: { category: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  insights: string[];
  recentSevere: Report | null;
  note: string;
};

export function getPatterns() {
  return api<Patterns>('GET', '/patterns', { auth: false });
}
