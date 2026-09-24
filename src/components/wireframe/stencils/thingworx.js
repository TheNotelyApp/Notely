import {
  Cpu,
  Activity,
  Radio,
  AlertTriangle,
  Disc,
  Gauge,
  Zap,
  ListTree,
  Sliders,
  Droplets,
  Power,
  BarChart3
} from "lucide-react";

export const thingworxStencils = [
  {
    id: "wf-twx-asset-card",
    label: "Thing Asset Health Card",
    category: "thingworx",
    desc: "ThingWorx Thing asset card with live beacon, OEE & property KPIs",
    icon: Cpu,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:18px;max-width:380px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:16px 0;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:10px;height:10px;border-radius:999px;background:#10b981;box-shadow:0 0 6px #10b981;display:inline-block;"></span>
          <div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;">CNC-Milling-04</div>
            <div style="font-size:10px;color:#64748b;">ThingTemplate: GenericMachinery</div>
          </div>
        </div>
        <span style="font-size:10px;font-weight:700;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;">CONNECTED</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#64748b;font-weight:700;">TEMP</div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">72.4°C</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#64748b;font-weight:700;">SPEED</div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:2px;">1,420 RPM</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:9px;color:#64748b;font-weight:700;">OEE</div>
          <div style="font-size:14px;font-weight:800;color:#2563eb;margin-top:2px;">88.6%</div>
        </div>
      </div>
      <div style="font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;">
        <span>Last scan: 2s ago</span>
        <span>Quality: Good (192)</span>
      </div>
    </div>`
  },
  {
    id: "wf-twx-radial-gauge",
    label: "ThingWorx Radial Dial Gauge",
    category: "thingworx",
    desc: "Industrial circular gauge with safe, warning & alarm zones",
    icon: Gauge,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:20px;max-width:280px;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,0.03);margin:16px 0;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Hydraulic Pressure</div>
      <div style="position:relative;width:180px;height:100px;margin:0 auto 10px;">
        <svg viewBox="0 0 180 100" style="width:100%;height:100%;">
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#e2e8f0" stroke-width="14" stroke-linecap="round"/>
          <path d="M 20 90 A 70 70 0 0 1 125 35" fill="none" stroke="#2563eb" stroke-width="14" stroke-linecap="round"/>
          <line x1="90" y1="90" x2="120" y2="40" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
          <circle cx="90" cy="90" r="6" fill="#0f172a"/>
        </svg>
      </div>
      <div style="font-size:24px;font-weight:900;color:#0f172a;">84.5 <span style="font-size:12px;color:#64748b;font-weight:600;">PSI</span></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:6px;padding:0 20px;">
        <span>0</span>
        <span style="color:#16a34a;font-weight:700;">Normal</span>
        <span>150</span>
      </div>
    </div>`
  },
  {
    id: "wf-twx-timeseries-chart",
    label: "TimeSeries Telemetry Chart",
    category: "thingworx",
    desc: "Industrial telemetry line chart with time window selector & live feed",
    icon: Activity,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:18px;margin:16px 0;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:800;color:#0f172a;">Motor Vibration Telemetry</span>
          <span style="font-size:9px;background:#eff6ff;color:#2563eb;padding:2px 6px;border-radius:4px;font-weight:700;">LIVE STREAM</span>
        </div>
        <div style="display:flex;gap:4px;font-size:10px;font-weight:600;">
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;cursor:pointer;">1h</button>
          <button style="padding:3px 8px;border:none;background:#2563eb;color:#ffffff;border-radius:4px;cursor:pointer;">8h</button>
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;cursor:pointer;">24h</button>
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;cursor:pointer;">7d</button>
        </div>
      </div>
      <div style="height:140px;width:100%;position:relative;">
        <svg viewBox="0 0 600 140" style="width:100%;height:100%;overflow:visible;">
          <line x1="0" y1="30" x2="600" y2="30" stroke="#f1f5f9" stroke-dasharray="4"/>
          <line x1="0" y1="70" x2="600" y2="70" stroke="#f1f5f9" stroke-dasharray="4"/>
          <line x1="0" y1="110" x2="600" y2="110" stroke="#f1f5f9" stroke-dasharray="4"/>
          <path d="M 0 110 Q 50 40, 100 80 T 200 60 T 300 90 T 400 45 T 500 70 T 600 35" fill="none" stroke="#2563eb" stroke-width="2.5"/>
          <path d="M 0 95 Q 50 85, 100 100 T 200 80 T 300 105 T 400 75 T 500 85 T 600 65" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="3"/>
          <circle cx="600" cy="35" r="4" fill="#2563eb"/>
        </svg>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:8px;">
        <div style="display:flex;gap:12px;">
          <span style="color:#2563eb;font-weight:600;">— Axis X (mm/s)</span>
          <span style="color:#10b981;font-weight:600;">-- Axis Y (mm/s)</span>
        </div>
        <span>Threshold limit: 4.5 mm/s</span>
      </div>
    </div>`
  },
  {
    id: "wf-twx-alarm-grid",
    label: "ThingWorx Alarm & Incident Grid",
    category: "thingworx",
    desc: "Active alarm console with severity, code, thing name & ack button",
    icon: AlertTriangle,
    content: `<div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;margin:16px 0;box-sizing:border-box;">
      <div style="background:#0f172a;color:#ffffff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>🚨 Industrial Alarm Console</span>
          <span style="background:#ef4444;color:#ffffff;font-size:10px;padding:2px 6px;border-radius:999px;">3 Active</span>
        </div>
        <button style="padding:4px 10px;border:none;background:#334155;color:#ffffff;border-radius:4px;font-size:10px;cursor:pointer;">Acknowledge All</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;text-align:left;">
        <thead style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;">
          <tr>
            <th style="padding:8px 12px;">Severity</th>
            <th style="padding:8px 12px;">Timestamp</th>
            <th style="padding:8px 12px;">Thing Name</th>
            <th style="padding:8px 12px;">Alarm Message</th>
            <th style="padding:8px 12px;text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;background:#fff5f5;">
            <td style="padding:8px 12px;"><span style="background:#fee2e2;color:#991b1b;font-weight:800;padding:2px 6px;border-radius:4px;font-size:9px;">CRITICAL</span></td>
            <td style="padding:8px 12px;color:#64748b;">11:42:08</td>
            <td style="padding:8px 12px;font-weight:700;color:#0f172a;">Extruder-Line-01</td>
            <td style="padding:8px 12px;color:#b91c1c;font-weight:600;">Barrel Temperature High High (> 280°C)</td>
            <td style="padding:8px 12px;text-align:right;"><button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;font-size:10px;cursor:pointer;">Ack</button></td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;"><span style="background:#fef3c7;color:#92400e;font-weight:800;padding:2px 6px;border-radius:4px;font-size:9px;">WARNING</span></td>
            <td style="padding:8px 12px;color:#64748b;">11:38:15</td>
            <td style="padding:8px 12px;font-weight:700;color:#0f172a;">Coolant-Pump-03</td>
            <td style="padding:8px 12px;color:#475569;">Flow Rate Deviation > 15%</td>
            <td style="padding:8px 12px;text-align:right;"><button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;font-size:10px;cursor:pointer;">Ack</button></td>
          </tr>
          <tr>
            <td style="padding:8px 12px;"><span style="background:#e0f2fe;color:#0369a1;font-weight:800;padding:2px 6px;border-radius:4px;font-size:9px;">INFO</span></td>
            <td style="padding:8px 12px;color:#64748b;">11:30:00</td>
            <td style="padding:8px 12px;font-weight:700;color:#0f172a;">Plant-Gateway-North</td>
            <td style="padding:8px 12px;color:#475569;">Periodic edge sync complete</td>
            <td style="padding:8px 12px;text-align:right;"><button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;font-size:10px;cursor:pointer;">Ack</button></td>
          </tr>
        </tbody>
      </table>
    </div>`
  },
  {
    id: "wf-twx-property-grid",
    label: "Thing Property Display Grid",
    category: "thingworx",
    desc: "Standard ThingWorx Thing properties table with data type & quality",
    icon: BarChart3,
    content: `<div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;margin:16px 0;box-sizing:border-box;">
      <div style="background:#f8fafc;padding:10px 14px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:700;color:#0f172a;">Thing Properties: PackagingUnit_02</span>
        <span style="font-size:10px;color:#64748b;">Auto-refresh: 1000ms</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;text-align:left;">
        <thead style="background:#f1f5f9;color:#64748b;">
          <tr>
            <th style="padding:7px 12px;">Property Name</th>
            <th style="padding:7px 12px;">Value</th>
            <th style="padding:7px 12px;">Type</th>
            <th style="padding:7px 12px;">Quality</th>
            <th style="padding:7px 12px;">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:7px 12px;font-weight:600;color:#0f172a;">conveyorSpeed</td>
            <td style="padding:7px 12px;font-weight:700;color:#2563eb;">2.4 m/s</td>
            <td style="padding:7px 12px;color:#64748b;">NUMBER</td>
            <td style="padding:7px 12px;color:#16a34a;font-weight:600;">GOOD (192)</td>
            <td style="padding:7px 12px;color:#94a3b8;">11:43:02</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:7px 12px;font-weight:600;color:#0f172a;">cycleCount</td>
            <td style="padding:7px 12px;font-weight:700;color:#0f172a;">18,492</td>
            <td style="padding:7px 12px;color:#64748b;">INTEGER</td>
            <td style="padding:7px 12px;color:#16a34a;font-weight:600;">GOOD (192)</td>
            <td style="padding:7px 12px;color:#94a3b8;">11:43:01</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:7px 12px;font-weight:600;color:#0f172a;">emergencyStopActive</td>
            <td style="padding:7px 12px;font-weight:700;color:#64748b;">false</td>
            <td style="padding:7px 12px;color:#64748b;">BOOLEAN</td>
            <td style="padding:7px 12px;color:#16a34a;font-weight:600;">GOOD (192)</td>
            <td style="padding:7px 12px;color:#94a3b8;">11:43:00</td>
          </tr>
          <tr>
            <td style="padding:7px 12px;font-weight:600;color:#0f172a;">operatingState</td>
            <td style="padding:7px 12px;font-weight:700;color:#16a34a;">RUNNING</td>
            <td style="padding:7px 12px;color:#64748b;">STRING</td>
            <td style="padding:7px 12px;color:#16a34a;font-weight:600;">GOOD (192)</td>
            <td style="padding:7px 12px;color:#94a3b8;">11:43:02</td>
          </tr>
        </tbody>
      </table>
    </div>`
  },
  {
    id: "wf-twx-tank-level",
    label: "P&ID Process Tank & Level",
    category: "thingworx",
    desc: "Industrial tank visual with dynamic level fill %, inlet/outlet valves",
    icon: Droplets,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:20px;max-width:320px;margin:16px 0;box-sizing:border-box;">
      <div style="font-size:12px;font-weight:800;color:#0f172a;text-align:center;margin-bottom:14px;">Storage Tank TK-102</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;">
        <div style="width:100px;height:160px;border:3px solid #334155;border-radius:12px;position:relative;background:#f8fafc;overflow:hidden;box-sizing:border-box;">
          <div style="position:absolute;bottom:0;width:100%;height:68%;background:linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);font-size:16px;font-weight:900;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.4);">68%</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;font-size:11px;">
          <div>
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Volume</div>
            <div style="font-weight:800;color:#0f172a;font-size:13px;">6,800 L</div>
          </div>
          <div>
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Inlet Valve V-1</div>
            <span style="background:#dcfce7;color:#166534;font-weight:700;padding:2px 6px;border-radius:4px;font-size:10px;">OPEN (92%)</span>
          </div>
          <div>
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Outlet Valve V-2</div>
            <span style="background:#fee2e2;color:#991b1b;font-weight:700;padding:2px 6px;border-radius:4px;font-size:10px;">CLOSED</span>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-twx-led-indicators",
    label: "Industrial LED Status Indicators",
    category: "thingworx",
    desc: "Machinery status beacon strip (Power, Ready, Run, Alarm, Comm)",
    icon: Disc,
    content: `<div style="background:#1e293b;border-radius:8px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;max-width:440px;margin:16px 0;box-sizing:border-box;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
        <span style="width:12px;height:12px;border-radius:999px;background:#10b981;box-shadow:0 0 8px #10b981;display:inline-block;"></span>
        <span style="font-size:10px;font-weight:700;color:#f8fafc;">POWER</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
        <span style="width:12px;height:12px;border-radius:999px;background:#10b981;box-shadow:0 0 8px #10b981;display:inline-block;"></span>
        <span style="font-size:10px;font-weight:700;color:#f8fafc;">READY</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
        <span style="width:12px;height:12px;border-radius:999px;background:#2563eb;box-shadow:0 0 8px #2563eb;display:inline-block;"></span>
        <span style="font-size:10px;font-weight:700;color:#f8fafc;">RUN</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
        <span style="width:12px;height:12px;border-radius:999px;background:#f59e0b;box-shadow:0 0 8px #f59e0b;display:inline-block;"></span>
        <span style="font-size:10px;font-weight:700;color:#f8fafc;">REMOTE</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
        <span style="width:12px;height:12px;border-radius:999px;background:#334155;display:inline-block;"></span>
        <span style="font-size:10px;font-weight:700;color:#64748b;">FAULT</span>
      </div>
    </div>`
  },
  {
    id: "wf-twx-numeric-readout",
    label: "Digital Telemetry Readout (KPI)",
    category: "thingworx",
    desc: "Industrial 7-segment style high-visibility numeric display",
    icon: Zap,
    content: `<div style="background:#0f172a;border-radius:8px;padding:16px 20px;max-width:240px;color:#ffffff;box-sizing:border-box;margin:16px 0;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Flow Rate Sensor 01</div>
      <div style="font-size:32px;font-weight:900;color:#38bdf8;font-family:monospace;letter-spacing:0.04em;">
        428.6 <span style="font-size:14px;color:#94a3b8;font-family:sans-serif;">GPM</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;margin-top:6px;border-top:1px solid #1e293b;padding-top:6px;">
        <span>MIN: 120.0</span>
        <span style="color:#22c55e;">▲ +4.2%</span>
        <span>MAX: 500.0</span>
      </div>
    </div>`
  },
  {
    id: "wf-twx-asset-tree",
    label: "Thing Asset Hierarchy Tree",
    category: "thingworx",
    desc: "Industrial Enterprise / Site / Line / Machine hierarchy tree selector",
    icon: ListTree,
    content: `<div style="border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;padding:16px;max-width:280px;margin:16px 0;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:10px;">Asset Hierarchy</div>
      <div style="font-size:11px;color:#334155;display:flex;flex-direction:column;gap:6px;">
        <div style="font-weight:700;color:#0f172a;">▾ 🏭 Plant North America</div>
        <div style="padding-left:14px;font-weight:600;color:#0f172a;">▾ ⚙️ Assembly Line 01</div>
        <div style="padding-left:28px;background:#eff6ff;color:#2563eb;font-weight:700;padding:4px 8px;border-radius:4px;">• 🤖 Robotic Arm 04 [Active]</div>
        <div style="padding-left:28px;color:#64748b;">• 📦 Packaging Station 02</div>
        <div style="padding-left:14px;color:#64748b;">▸ ⚙️ Assembly Line 02</div>
        <div style="padding-left:14px;color:#64748b;">▸ ❄️ Utilities & HVAC</div>
      </div>
    </div>`
  },
  {
    id: "wf-twx-control-panel",
    label: "Operator Control Switch & E-Stop",
    category: "thingworx",
    desc: "Industrial physical controls with Start, Stop, and Emergency E-Stop",
    icon: Power,
    content: `<div style="background:#f1f5f9;border:2px solid #cbd5e1;border-radius:8px;padding:18px;max-width:340px;margin:16px 0;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;text-align:center;">Operator Control Console</div>
      <div style="display:flex;align-items:center;justify-content:space-around;">
        <button style="width:48px;height:48px;border-radius:999px;background:#16a34a;color:#ffffff;border:3px solid #15803d;font-weight:800;font-size:11px;cursor:pointer;box-shadow:0 3px 6px rgba(0,0,0,0.15);">START</button>
        <button style="width:48px;height:48px;border-radius:999px;background:#dc2626;color:#ffffff;border:3px solid #b91c1c;font-weight:800;font-size:11px;cursor:pointer;box-shadow:0 3px 6px rgba(0,0,0,0.15);">STOP</button>
        <div style="text-align:center;">
          <button style="width:56px;height:56px;border-radius:999px;background:#b91c1c;color:#ffffff;border:4px solid #facc15;font-weight:900;font-size:10px;cursor:pointer;box-shadow:0 4px 10px rgba(185,28,28,0.4);">E-STOP</button>
          <div style="font-size:9px;font-weight:800;color:#dc2626;margin-top:3px;">EMERGENCY</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-twx-oee-summary",
    label: "ThingWorx OEE Metric Breakdown",
    category: "thingworx",
    desc: "Overall Equipment Effectiveness with Availability, Performance, Quality",
    icon: Radio,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:18px;max-width:440px;margin:16px 0;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:13px;font-weight:800;color:#0f172a;">OEE Performance Scorecard</span>
        <span style="font-size:22px;font-weight:900;color:#2563eb;">84.2%</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
            <span style="color:#475569;font-weight:600;">Availability (Uptime)</span>
            <span style="font-weight:700;color:#0f172a;">92.0%</span>
          </div>
          <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
            <div style="width:92%;height:100%;background:#10b981;"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
            <span style="color:#475569;font-weight:600;">Performance (Speed vs Rated)</span>
            <span style="font-weight:700;color:#0f172a;">88.5%</span>
          </div>
          <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
            <div style="width:88.5%;height:100%;background:#2563eb;"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
            <span style="color:#475569;font-weight:600;">Quality (Good Parts %)</span>
            <span style="font-weight:700;color:#0f172a;">99.2%</span>
          </div>
          <div style="height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden;">
            <div style="width:99.2%;height:100%;background:#8b5cf6;"></div>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-twx-shift-filter",
    label: "Industrial Shift & Time Picker",
    category: "thingworx",
    desc: "Shift 1, Shift 2, Night shift buttons + custom telemetry interval",
    icon: Sliders,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin:16px 0;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;">
        <span style="color:#64748b;">Shift:</span>
        <button style="padding:4px 8px;border:none;background:#2563eb;color:#ffffff;border-radius:4px;cursor:pointer;">Shift 1 (Day)</button>
        <button style="padding:4px 8px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;border-radius:4px;cursor:pointer;">Shift 2 (Eve)</button>
        <button style="padding:4px 8px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;border-radius:4px;cursor:pointer;">Shift 3 (Night)</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;">
        <span style="color:#64748b;">Interval:</span>
        <select style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">
          <option>5s Average</option>
          <option>1m Rollup</option>
          <option>1h Aggregated</option>
        </select>
      </div>
    </div>`
  }
];
