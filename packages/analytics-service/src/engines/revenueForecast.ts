/**
 * Revenue Forecasting Engine
 * 30/60/90 day commission projections with confidence intervals.
 * At launch: linear trend extrapolation (Prophet model trains post-launch with real data).
 */
import { query, queryOne } from '@nirmalmandi/shared';

export interface RevenueForecast {
  forecast_30d: number;
  forecast_60d: number;
  forecast_90d: number;
  confidence_interval: { lower: number; upper: number };
  trend: 'growing' | 'stable' | 'declining';
  trend_pct: number;
  daily_commission_avg_7d: number;
  daily_commission_avg_30d: number;
  generated_at: string;
}

export async function getRevenueForecast(): Promise<RevenueForecast> {
  // Get daily commission for last 30 days
  const dailyData = await query<{ date: string; commission: number }>(
    `SELECT DATE(created_at) as date, SUM(platform_commission) as commission
     FROM orders
     WHERE status IN ('completed','delivered')
       AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  if (dailyData.length < 3) {
    // Insufficient data — return conservative baseline
    return {
      forecast_30d: 0, forecast_60d: 0, forecast_90d: 0,
      confidence_interval: { lower: 0, upper: 0 },
      trend: 'stable', trend_pct: 0,
      daily_commission_avg_7d: 0, daily_commission_avg_30d: 0,
      generated_at: new Date().toISOString(),
    };
  }

  const values = dailyData.map(d => d.commission);
  const avg30 = values.reduce((a, b) => a + b, 0) / values.length;
  const avg7 = values.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, values.length);

  // Trend: compare last 7d avg vs prior 7d avg
  const prior7 = values.slice(-14, -7);
  const prior7Avg = prior7.length > 0 ? prior7.reduce((a, b) => a + b, 0) / prior7.length : avg30;
  const trend_pct = prior7Avg > 0 ? Math.round(((avg7 - prior7Avg) / prior7Avg) * 100) : 0;
  const trend = trend_pct > 5 ? 'growing' : trend_pct < -5 ? 'declining' : 'stable';

  // Simple linear projection using recent trend
  const growthRate = 1 + Math.max(-0.3, Math.min(0.5, trend_pct / 100));
  const forecast_30d = Math.round(avg7 * 30 * growthRate);
  const forecast_60d = Math.round(avg7 * 60 * Math.pow(growthRate, 1.5));
  const forecast_90d = Math.round(avg7 * 90 * Math.pow(growthRate, 2));

  // Confidence interval: ±20% for 30d, ±35% for 90d
  return {
    forecast_30d,
    forecast_60d,
    forecast_90d,
    confidence_interval: {
      lower: Math.round(forecast_30d * 0.8),
      upper: Math.round(forecast_30d * 1.2),
    },
    trend,
    trend_pct,
    daily_commission_avg_7d: Math.round(avg7),
    daily_commission_avg_30d: Math.round(avg30),
    generated_at: new Date().toISOString(),
  };
}
