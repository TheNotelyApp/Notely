import { BarChart3, TrendingUp, CheckSquare } from "lucide-react";

export const metricStencils = [
  {
    id: "wf-kpi-stats-row",
    label: "KPI Metric Stats Row",
    category: "metrics",
    desc: "3 metric KPI cards with delta percentages",
    icon: BarChart3,
    content: `<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin:16px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;">Monthly Revenue</div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;">
          <span style="font-size:24px;font-weight:800;color:#0f172a;">$48,250</span>
          <span style="background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">+12.4%</span>
        </div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;">Active Projects</div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;">
          <span style="font-size:24px;font-weight:800;color:#0f172a;">1,420</span>
          <span style="background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">+8.1%</span>
        </div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;">Avg. Response Time</div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;">
          <span style="font-size:24px;font-weight:800;color:#0f172a;">184ms</span>
          <span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">-2.3%</span>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-chart-line",
    label: "Line Trend Graph Card",
    category: "metrics",
    desc: "Stat metric with vector trendline polyline",
    icon: TrendingUp,
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin:14px 0;box-shadow:0 2px 4px rgba(0,0,0,0.02);box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <div style="font-size:11px;font-weight:600;color:#64748b;">Daily Pageviews</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;">128,490</div>
        </div>
        <span style="background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:700;">+24.5%</span>
      </div>
      <div style="height:70px;width:100%;display:flex;align-items:flex-end;">
        <svg viewBox="0 0 300 70" style="width:100%;height:100%;overflow:visible;">
          <polyline fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" points="0,55 40,45 80,50 120,25 160,35 200,15 240,22 280,8 300,10" />
        </svg>
      </div>
    </div>`
  },
  {
    id: "wf-chart-bars",
    label: "Monthly Bar Graph Card",
    category: "metrics",
    desc: "Histogram comparison columns",
    icon: BarChart3,
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin:14px 0;box-shadow:0 2px 4px rgba(0,0,0,0.02);box-sizing:border-box;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:12px;">Quarterly Growth</div>
      <div style="display:flex;align-items:flex-end;gap:12px;height:80px;">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:100%;height:30px;background:#e2e8f0;border-radius:4px 4px 0 0;"></div>
          <span style="font-size:9px;color:#64748b;">Jan</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:100%;height:50px;background:#e2e8f0;border-radius:4px 4px 0 0;"></div>
          <span style="font-size:9px;color:#64748b;">Feb</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:100%;height:70px;background:#2563eb;border-radius:4px 4px 0 0;"></div>
          <span style="font-size:9px;color:#2563eb;font-weight:700;">Mar</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:100%;height:40px;background:#e2e8f0;border-radius:4px 4px 0 0;"></div>
          <span style="font-size:9px;color:#64748b;">Apr</span>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-goal-tracker",
    label: "Progress & Goal Tracker",
    category: "metrics",
    desc: "Target milestone bar with percentage indicator",
    icon: CheckSquare,
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:14px 0;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:6px;">
        <span style="color:#0f172a;">Sprint Goals</span>
        <span style="color:#2563eb;font-weight:700;">72%</span>
      </div>
      <div style="width:100%;height:7px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-bottom:8px;">
        <div style="width:72%;height:100%;background:#2563eb;border-radius:999px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;">
        <span>18 of 25 done</span>
        <span>4 days left</span>
      </div>
    </div>`
  }
];
