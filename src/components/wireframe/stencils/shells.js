import {
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Terminal,
  Store,
  Columns,
  AppWindow,
  BarChart2,
  Users,
  DollarSign,
  Server,
  Headset,
  PanelLeft,
  Menu
} from "lucide-react";

export const shellStencils = [
  {
    id: "wf-shell-saas-master",
    label: "SaaS Multi-Tenant Shell",
    category: "layouts",
    desc: "Complete SaaS app shell with workspace switcher, global search & user menu",
    icon: AppWindow,
    content: `<div style="display:flex;width:100%;min-height:560px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:230px;background:#0f172a;color:#ffffff;display:flex;flex-direction:column;padding:16px;flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #1e293b;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:24px;height:24px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;">N</div>
            <span style="font-weight:800;font-size:13px;">Acme Cloud</span>
          </div>
          <span style="font-size:10px;color:#94a3b8;">▾</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;flex:1;">
          <div style="background:#2563eb;color:#ffffff;padding:8px 12px;border-radius:6px;font-weight:600;">📊 Dashboard</div>
          <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;">📁 Projects</div>
          <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;">👥 Team Members</div>
          <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;">📈 Analytics</div>
          <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;margin-top:auto;">⚙️ Settings</div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;background:#f8fafc;">
        <header style="height:54px;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;">
            <span>Projects</span><span>/</span><span style="font-weight:700;color:#0f172a;">Q3 Wireframes</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="text" placeholder="Search resources..." style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;width:180px;" />
            <div style="width:30px;height:30px;border-radius:999px;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">JD</div>
          </div>
        </header>
        <main style="flex:1;padding:24px;box-sizing:border-box;">
          <div style="border:2px dashed #cbd5e1;border-radius:8px;min-height:380px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;background:#ffffff;">
            Drop main dashboard cards, grids, or tables here
          </div>
        </main>
      </div>
    </div>`
  },
  {
    id: "wf-shell-developer-ide",
    label: "Developer IDE Studio Shell",
    category: "layouts",
    desc: "Activity icon rail + collapsible file tree + tabbed editor + status bar",
    icon: Laptop,
    content: `<div style="display:flex;width:100%;min-height:500px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#f8fafc;overflow:hidden;margin:16px 0;box-sizing:border-box;font-family:system-ui, sans-serif;">
      <div style="width:48px;background:#090d16;display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:16px;flex-shrink:0;border-right:1px solid #1e293b;font-size:16px;color:#64748b;">
        <span style="color:#ffffff;">📄</span>
        <span>🔍</span>
        <span>🌿</span>
        <span>⚙️</span>
      </div>
      <div style="width:200px;background:#0f172a;border-right:1px solid #1e293b;padding:12px;display:flex;flex-direction:column;flex-shrink:0;font-size:11px;">
        <div style="font-weight:800;text-transform:uppercase;color:#94a3b8;font-size:10px;margin-bottom:10px;">Explorer</div>
        <div style="color:#ffffff;font-weight:600;margin-bottom:4px;">▾ src/</div>
        <div style="padding-left:12px;color:#94a3b8;margin-bottom:3px;">▾ components/</div>
        <div style="padding-left:24px;color:#38bdf8;background:#1e293b;padding-top:2px;padding-bottom:2px;border-radius:3px;">• WireframeEditor.jsx</div>
        <div style="padding-left:24px;color:#94a3b8;margin-bottom:3px;">• WireframeBlock.jsx</div>
        <div style="padding-left:12px;color:#94a3b8;">▸ styles/</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;background:#1e293b;">
        <div style="height:34px;background:#0f172a;display:flex;align-items:center;padding:0 8px;gap:2px;border-bottom:1px solid #1e293b;">
          <div style="background:#1e293b;color:#ffffff;padding:6px 12px;border-radius:4px 4px 0 0;font-size:11px;display:flex;align-items:center;gap:6px;">
            <span>WireframeEditor.jsx</span>
            <span style="color:#94a3b8;font-size:10px;">✕</span>
          </div>
        </div>
        <div style="flex:1;padding:20px;font-family:monospace;font-size:12px;color:#cbd5e1;background:#131d2e;">
          <div style="color:#60a5fa;">import React, { useState } from 'react';</div>
          <div style="color:#94a3b8;margin-top:6px;">// Main editor surface</div>
        </div>
        <footer style="height:24px;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:10px;">
          <span>Ready · UTF-8 · JavaScript React</span>
          <span>Ln 1, Col 1</span>
        </footer>
      </div>
    </div>`
  },
  {
    id: "wf-shell-admin-console",
    label: "Enterprise Admin Console Shell",
    category: "layouts",
    desc: "Header with global tenant selector + dark sidebar with badge counts + viewport",
    icon: Monitor,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:520px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <header style="height:48px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font-size:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-weight:800;font-size:14px;color:#38bdf8;">Enterprise Admin</span>
          <span style="background:#1e293b;padding:2px 8px;border-radius:4px;font-size:10px;color:#94a3b8;">Production (us-east-1)</span>
        </div>
        <div style="display:flex;gap:12px;align-items:center;font-size:11px;color:#94a3b8;">
          <span>System Status: <strong style="color:#22c55e;">Operational</strong></span>
          <div style="width:26px;height:26px;border-radius:999px;background:#334155;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;">A</div>
        </div>
      </header>
      <div style="display:flex;flex:1;">
        <nav style="width:210px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:16px;display:flex;flex-direction:column;gap:6px;font-size:11px;flex-shrink:0;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:8px;">Core Administration</div>
          <div style="background:#eff6ff;color:#2563eb;padding:6px 10px;border-radius:6px;font-weight:600;display:flex;justify-content:space-between;">
            <span>Users & Access</span><span style="background:#2563eb;color:#ffffff;padding:0 6px;border-radius:999px;font-size:9px;">142</span>
          </div>
          <div style="color:#64748b;padding:6px 10px;border-radius:6px;display:flex;justify-content:space-between;">
            <span>API Gateways</span><span style="background:#e2e8f0;padding:0 6px;border-radius:999px;font-size:9px;">4</span>
          </div>
          <div style="color:#64748b;padding:6px 10px;border-radius:6px;">Audit Logs</div>
          <div style="color:#64748b;padding:6px 10px;border-radius:6px;">Billing & Usage</div>
        </nav>
        <main style="flex:1;padding:24px;background:#ffffff;box-sizing:border-box;">
          <div style="border:1px dashed #cbd5e1;border-radius:6px;min-height:360px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;background:#fafafa;">
            Main admin table, audit stream, or management cards
          </div>
        </main>
      </div>
    </div>`
  },
  {
    id: "wf-shell-mobile-device",
    label: "Smartphone Frame with Dynamic Notch",
    category: "layouts",
    desc: "iPhone style mobile frame with speaker notch, status bar & bottom indicator",
    icon: Smartphone,
    content: `<div style="width:375px;min-height:700px;background:#ffffff;border:4px solid #0f172a;border-radius:36px;padding:16px 14px 20px;margin:20px auto;box-shadow:0 16px 40px rgba(0,0,0,0.15);position:relative;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="width:110px;height:22px;background:#0f172a;border-radius:999px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
        <span style="width:8px;height:8px;background:#1e293b;border-radius:999px;"></span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#0f172a;padding:0 6px;margin-bottom:12px;">
        <span>9:41</span>
        <span>5G 📶 100% 🔋</span>
      </div>
      <div style="flex:1;border:1px dashed #cbd5e1;border-radius:16px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;padding:20px;text-align:center;">
        Mobile application screen content viewport
      </div>
      <div style="width:120px;height:4px;background:#0f172a;border-radius:999px;margin:16px auto 0;"></div>
    </div>`
  },
  {
    id: "wf-shell-tablet-landscape",
    label: "Tablet Landscape Split-View Shell",
    category: "layouts",
    desc: "iPad style landscape tablet shell with master pane & detail stage",
    icon: Tablet,
    content: `<div style="width:780px;min-height:500px;background:#ffffff;border:4px solid #1e293b;border-radius:20px;padding:18px;margin:20px auto;box-shadow:0 12px 32px rgba(0,0,0,0.12);display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:#64748b;margin-bottom:12px;padding:0 4px;">
        <span>Tablet Viewport · 780px</span>
        <span>Landscape Mode</span>
      </div>
      <div style="flex:1;display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="width:240px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:16px;box-sizing:border-box;">
          <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px;">Master Navigation</div>
          <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font-size:11px;color:#0f172a;font-weight:600;margin-bottom:6px;">Active Document</div>
          <div style="padding:10px;font-size:11px;color:#64748b;">Archived Records</div>
        </div>
        <div style="flex:1;padding:20px;background:#ffffff;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;border:1px dashed #cbd5e1;margin:12px;border-radius:6px;">
          Detail Inspection Canvas
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-shell-ecommerce-store",
    label: "E-Commerce Storefront Shell",
    category: "layouts",
    desc: "Top announcement bar + mega navigation + product stage + footer",
    icon: Store,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:540px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="height:28px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;">
        ⚡ Free shipping on all technical gear orders over $75
      </div>
      <header style="height:56px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
        <div style="font-weight:900;font-size:16px;color:#0f172a;">Storefront</div>
        <div style="display:flex;gap:18px;font-size:12px;color:#475569;font-weight:600;">
          <span>New Arrivals</span><span>Computers</span><span>Sensors</span><span>Accessories</span>
        </div>
        <div style="display:flex;gap:10px;font-size:12px;">
          <input type="text" placeholder="Search catalog..." style="padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;" />
          <button style="padding:5px 12px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;">Cart (2)</button>
        </div>
      </header>
      <main style="flex:1;padding:24px;background:#ffffff;box-sizing:border-box;">
        <div style="border:2px dashed #cbd5e1;border-radius:8px;min-height:300px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;background:#f8fafc;">
          Drop storefront hero banners, product grids, or reviews here
        </div>
      </main>
      <footer style="height:44px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:11px;color:#64748b;">
        <span>© 2026 Storefront Inc.</span>
        <span>Customer Support • Shipping Info • Returns</span>
      </footer>
    </div>`
  },
  {
    id: "wf-shell-terminal-cli",
    label: "Terminal & CLI Command Shell",
    category: "layouts",
    desc: "Window frame with traffic light controls + monospace interactive CLI surface",
    icon: Terminal,
    content: `<div style="max-width:640px;margin:20px auto;border-radius:8px;background:#0f172a;border:1px solid #1e293b;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.25);box-sizing:border-box;">
      <div style="height:32px;background:#1e293b;display:flex;align-items:center;padding:0 12px;justify-content:space-between;">
        <div style="display:flex;gap:6px;">
          <span style="width:10px;height:10px;border-radius:999px;background:#ef4444;display:inline-block;"></span>
          <span style="width:10px;height:10px;border-radius:999px;background:#f59e0b;display:inline-block;"></span>
          <span style="width:10px;height:10px;border-radius:999px;background:#10b981;display:inline-block;"></span>
        </div>
        <span style="font-size:11px;color:#94a3b8;font-family:monospace;">bash — notely-cli</span>
        <span style="width:10px;"></span>
      </div>
      <div style="padding:20px;font-family:monospace;font-size:12px;color:#f8fafc;min-height:220px;line-height:1.7;">
        <div><span style="color:#22c55e;">notely@local</span>:<span style="color:#38bdf8;">~/workspace</span>$ wireframe --init saas-shell</div>
        <div style="color:#94a3b8;">[info] Loaded 83 wireframe stencils across 13 categories...</div>
        <div style="color:#22c55e;">[ok] Generated wireframe canvas preview at 1200x800</div>
        <div><span style="color:#22c55e;">notely@local</span>:<span style="color:#38bdf8;">~/workspace</span>$ <span style="display:inline-block;width:7px;height:13px;background:#38bdf8;vertical-align:middle;"></span></div>
      </div>
    </div>`
  },
  {
    id: "wf-shell-split-onboarding",
    label: "Split-Screen Brand Onboarding Shell",
    category: "layouts",
    desc: "50% dark brand showcase on left + 50% clean auth & registration on right",
    icon: Columns,
    content: `<div style="display:flex;width:100%;min-height:460px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;margin:16px 0;box-sizing:border-box;">
      <div style="flex:1;background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);color:#ffffff;padding:48px 36px;display:flex;flex-direction:column;justify-content:center;">
        <span style="font-size:11px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Notely Platform</span>
        <h2 style="font-size:24px;font-weight:900;line-height:1.2;margin:0 0 12px;">Unified local technical workspace</h2>
        <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0 0 20px;">Notes, offline diagrams, GrapesJS wireframes, and ThingWorx IoT telemetry.</p>
        <div style="font-size:11px;color:#cbd5e1;background:rgba(255,255,255,0.06);padding:10px 14px;border-radius:6px;border-left:3px solid #38bdf8;">
          "The fastest way to mock up full-stack industrial applications."
        </div>
      </div>
      <div style="flex:1;padding:48px 40px;display:flex;flex-direction:column;justify-content:center;background:#ffffff;">
        <h3 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 6px;">Create your account</h3>
        <p style="font-size:11px;color:#64748b;margin:0 0 18px;">Start designing wireframes immediately.</p>
        <button style="width:100%;padding:9px;border:1px solid #cbd5e1;background:#ffffff;border-radius:6px;font-size:11px;font-weight:600;margin-bottom:12px;cursor:pointer;">Continue with GitHub</button>
        <div style="text-align:center;font-size:10px;color:#94a3b8;margin-bottom:12px;">or with work email</div>
        <input type="email" placeholder="name@company.com" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-bottom:12px;box-sizing:border-box;" />
        <button style="padding:9px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Get Started</button>
      </div>
    </div>`
  },
  {
    id: "wf-shell-admin-bi",
    label: "Admin BI & Analytics Shell",
    category: "layouts",
    desc: "Executive BI dashboard with date filter, 4 KPI cards, chart stage & breakdown",
    icon: BarChart2,
    content: `<div style="display:flex;width:100%;min-height:640px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:220px;background:#0f172a;color:#ffffff;padding:20px 14px;display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <div style="font-weight:900;font-size:14px;color:#38bdf8;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
          <span>⚡ Nexus BI Admin</span>
        </div>
        <div style="background:#2563eb;color:#ffffff;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;">Executive Overview</div>
        <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;font-size:12px;">Revenue & MRR</div>
        <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;font-size:12px;">Customer Churn</div>
        <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;font-size:12px;">Cohorts & Retention</div>
        <div style="color:#94a3b8;padding:8px 12px;border-radius:6px;font-size:12px;margin-top:auto;">System Settings</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;">
        <header style="height:56px;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
          <div style="font-size:15px;font-weight:800;color:#0f172a;">Executive Analytics Overview</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <select style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;background:#ffffff;">
              <option>Last 30 Days (Trailing)</option>
              <option>Quarter to Date (Q3)</option>
              <option>Year to Date (2026)</option>
            </select>
            <button style="padding:6px 12px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Export PDF</button>
          </div>
        </header>
        <div style="padding:24px;flex:1;display:flex;flex-direction:column;gap:20px;overflow-y:auto;box-sizing:border-box;">
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Monthly Recurring</div>
              <div style="font-size:22px;font-weight:900;color:#0f172a;margin:6px 0 2px;">$128,450</div>
              <div style="font-size:10px;color:#16a34a;font-weight:700;">▲ +14.2% MoM</div>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Active Accounts</div>
              <div style="font-size:22px;font-weight:900;color:#0f172a;margin:6px 0 2px;">14,290</div>
              <div style="font-size:10px;color:#16a34a;font-weight:700;">▲ +8.6% MoM</div>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Gross Churn Rate</div>
              <div style="font-size:22px;font-weight:900;color:#0f172a;margin:6px 0 2px;">0.82%</div>
              <div style="font-size:10px;color:#16a34a;font-weight:700;">▼ -0.15% (Healthy)</div>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Average LTV</div>
              <div style="font-size:22px;font-weight:900;color:#0f172a;margin:6px 0 2px;">$2,450</div>
              <div style="font-size:10px;color:#16a34a;font-weight:700;">▲ +5.1% MoM</div>
            </div>
          </div>
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;min-height:220px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px dashed #cbd5e1;color:#94a3b8;font-size:13px;">
            Full-Width Revenue & Cohort Performance Chart Stage
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px;">Top Acquisition Channels</div>
              <div style="font-size:11px;color:#64748b;">Organic Search (42%) • Direct Referrals (28%) • Partner API (18%)</div>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px;">Regional Breakdown</div>
              <div style="font-size:11px;color:#64748b;">North America (64%) • EMEA (24%) • APAC (12%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-shell-admin-users",
    label: "Admin IAM User Management Shell",
    category: "layouts",
    desc: "Enterprise user administration with role filters, bulk actions & table pagination",
    icon: Users,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:560px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <header style="height:56px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-weight:900;font-size:15px;color:#38bdf8;">Identity & Access Management</span>
          <span style="background:#1e293b;padding:2px 8px;border-radius:4px;font-size:10px;color:#94a3b8;">Org: Acme-Global</span>
        </div>
        <button style="padding:6px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">+ Invite Member</button>
      </header>
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;">
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="text" placeholder="Search by name or email..." style="padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;width:240px;" />
          <select style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;background:#ffffff;">
            <option>All Roles (142)</option>
            <option>Super Admin (3)</option>
            <option>Editor (48)</option>
            <option>Viewer (91)</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <button style="padding:6px 12px;border:1px solid #cbd5e1;background:#ffffff;border-radius:6px;font-size:11px;cursor:pointer;">Export CSV</button>
          <button style="padding:6px 12px;border:1px solid #fca5a5;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:11px;cursor:pointer;">Bulk Suspend</button>
        </div>
      </div>
      <div style="flex:1;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;text-align:left;">
          <thead style="background:#f1f5f9;color:#475569;border-bottom:1px solid #e2e8f0;">
            <tr>
              <th style="padding:10px 18px;width:30px;"><input type="checkbox" /></th>
              <th style="padding:10px 18px;">User Name</th>
              <th style="padding:10px 18px;">Email Address</th>
              <th style="padding:10px 18px;">Role</th>
              <th style="padding:10px 18px;">2FA Security</th>
              <th style="padding:10px 18px;">Last Active</th>
              <th style="padding:10px 18px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 18px;"><input type="checkbox" /></td>
              <td style="padding:10px 18px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:8px;">
                <div style="width:24px;height:24px;border-radius:999px;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:10px;">SJ</div>
                Sarah Jenkins
              </td>
              <td style="padding:10px 18px;color:#64748b;">sarah@company.com</td>
              <td style="padding:10px 18px;"><span style="background:#eff6ff;color:#2563eb;font-weight:700;padding:2px 8px;border-radius:4px;font-size:9px;">SUPER ADMIN</span></td>
              <td style="padding:10px 18px;"><span style="background:#dcfce7;color:#166534;font-weight:700;padding:2px 8px;border-radius:4px;font-size:9px;">ENABLED (HARDWARE)</span></td>
              <td style="padding:10px 18px;color:#94a3b8;">4 minutes ago</td>
              <td style="padding:10px 18px;text-align:right;color:#64748b;cursor:pointer;">•••</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 18px;"><input type="checkbox" /></td>
              <td style="padding:10px 18px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:8px;">
                <div style="width:24px;height:24px;border-radius:999px;background:#10b981;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:10px;">MR</div>
                Marcus Reed
              </td>
              <td style="padding:10px 18px;color:#64748b;">marcus@company.com</td>
              <td style="padding:10px 18px;"><span style="background:#f1f5f9;color:#334155;font-weight:700;padding:2px 8px;border-radius:4px;font-size:9px;">EDITOR</span></td>
              <td style="padding:10px 18px;"><span style="background:#dcfce7;color:#166534;font-weight:700;padding:2px 8px;border-radius:4px;font-size:9px;">ENABLED (APP)</span></td>
              <td style="padding:10px 18px;color:#94a3b8;">1 hour ago</td>
              <td style="padding:10px 18px;text-align:right;color:#64748b;cursor:pointer;">•••</td>
            </tr>
            <tr>
              <td style="padding:10px 18px;"><input type="checkbox" /></td>
              <td style="padding:10px 18px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:8px;">
                <div style="width:24px;height:24px;border-radius:999px;background:#f59e0b;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:10px;">AL</div>
                Anna Lin
              </td>
              <td style="padding:10px 18px;color:#64748b;">anna.lin@partner.org</td>
              <td style="padding:10px 18px;"><span style="background:#f1f5f9;color:#64748b;font-weight:700;padding:2px 8px;border-radius:4px;font-size:9px;">VIEWER</span></td>
              <td style="padding:10px 18px;"><span style="background:#fee2e2;color:#991b1b;font-weight:700;padding:2px 8px;border-radius:4px;font-size:9px;">PENDING SETUP</span></td>
              <td style="padding:10px 18px;color:#94a3b8;">3 days ago</td>
              <td style="padding:10px 18px;text-align:right;color:#64748b;cursor:pointer;">•••</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer style="height:44px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;font-size:11px;color:#64748b;">
        <span>Showing 1 to 3 of 142 members</span>
        <div style="display:flex;gap:4px;">
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;cursor:pointer;">Prev</button>
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#2563eb;color:#ffffff;border-radius:4px;cursor:pointer;">1</button>
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;cursor:pointer;">2</button>
          <button style="padding:3px 8px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;cursor:pointer;">Next</button>
        </div>
      </footer>
    </div>`
  },
  {
    id: "wf-shell-admin-finance",
    label: "Admin Fintech & Billing Shell",
    category: "layouts",
    desc: "Payment operations console with balance banner, payout actions & transactions",
    icon: DollarSign,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:560px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);color:#ffffff;padding:28px 32px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;">Total Available Balance</span>
          <div style="font-size:32px;font-weight:900;color:#ffffff;margin:6px 0 4px;">$384,920.40 <span style="font-size:14px;color:#38bdf8;font-weight:600;">USD</span></div>
          <div style="font-size:11px;color:#22c55e;">● Instant payout ready ($42,100 in transit)</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button style="padding:8px 16px;background:#ffffff;color:#0f172a;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">+ Add Funds</button>
          <button style="padding:8px 16px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Create Payout →</button>
        </div>
      </div>
      <div style="padding:24px;flex:1;display:flex;flex-direction:column;gap:18px;">
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:14px;">
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc;">
            <div style="font-size:10px;font-weight:700;color:#64748b;">GROSS VOLUME (30D)</div>
            <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px;">$1.24M</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc;">
            <div style="font-size:10px;font-weight:700;color:#64748b;">PENDING DISPUTES</div>
            <div style="font-size:20px;font-weight:800;color:#d97706;margin-top:4px;">2 cases ($640)</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc;">
            <div style="font-size:10px;font-weight:700;color:#64748b;">PAYOUT SCHEDULE</div>
            <div style="font-size:20px;font-weight:800;color:#2563eb;margin-top:4px;">Daily (Automatic)</div>
          </div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <div style="background:#f1f5f9;padding:10px 16px;font-size:12px;font-weight:700;color:#0f172a;">Recent Payment Transactions</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tbody>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 16px;font-weight:700;color:#0f172a;">Enterprise Tier Annual</td>
                <td style="padding:10px 16px;color:#64748b;">cus_918237</td>
                <td style="padding:10px 16px;"><span style="background:#dcfce7;color:#166534;font-weight:700;padding:2px 6px;border-radius:4px;font-size:9px;">SUCCEEDED</span></td>
                <td style="padding:10px 16px;font-weight:800;color:#0f172a;text-align:right;">+$12,000.00</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 16px;font-weight:700;color:#0f172a;">Pro Team Monthly</td>
                <td style="padding:10px 16px;color:#64748b;">cus_481029</td>
                <td style="padding:10px 16px;"><span style="background:#dcfce7;color:#166534;font-weight:700;padding:2px 6px;border-radius:4px;font-size:9px;">SUCCEEDED</span></td>
                <td style="padding:10px 16px;font-weight:800;color:#0f172a;text-align:right;">+$240.00</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-weight:700;color:#0f172a;">Starter Plan Monthly</td>
                <td style="padding:10px 16px;color:#64748b;">cus_330912</td>
                <td style="padding:10px 16px;"><span style="background:#fee2e2;color:#991b1b;font-weight:700;padding:2px 6px;border-radius:4px;font-size:9px;">CARD DECLINED</span></td>
                <td style="padding:10px 16px;font-weight:800;color:#dc2626;text-align:right;">$29.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-shell-admin-devops",
    label: "Admin DevOps & Cloud Cluster Shell",
    category: "layouts",
    desc: "Cluster health, CPU/RAM utilization gauges, service matrix & incident stream",
    icon: Server,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:560px;border:1px solid #1e293b;border-radius:8px;background:#090d16;color:#f8fafc;overflow:hidden;margin:16px 0;box-sizing:border-box;font-family:system-ui, sans-serif;">
      <header style="height:50px;background:#0f172a;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;padding:0 20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-weight:900;font-size:14px;color:#38bdf8;">☸️ K8s Cluster Monitor</span>
          <span style="background:#1e293b;padding:2px 8px;border-radius:4px;font-size:10px;color:#22c55e;">● 24 / 24 Nodes Healthy</span>
        </div>
        <div style="font-size:11px;color:#94a3b8;">Uptime: 99.98% (Last 90 days)</div>
      </header>
      <div style="padding:20px;flex:1;display:flex;flex-direction:column;gap:16px;">
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;">
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;">CPU UTILIZATION</div>
            <div style="font-size:22px;font-weight:900;color:#38bdf8;margin:4px 0;">42.8%</div>
            <div style="height:4px;background:#1e293b;border-radius:999px;overflow:hidden;"><div style="width:42.8%;height:100%;background:#38bdf8;"></div></div>
          </div>
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;">MEMORY USAGE</div>
            <div style="font-size:22px;font-weight:900;color:#22c55e;margin:4px 0;">64.2%</div>
            <div style="height:4px;background:#1e293b;border-radius:999px;overflow:hidden;"><div style="width:64.2%;height:100%;background:#22c55e;"></div></div>
          </div>
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;">NETWORK INGRESS</div>
            <div style="font-size:22px;font-weight:900;color:#a855f7;margin:4px 0;">1.42 GB/s</div>
            <div style="height:4px;background:#1e293b;border-radius:999px;overflow:hidden;"><div style="width:58%;height:100%;background:#a855f7;"></div></div>
          </div>
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;">ACTIVE PODS</div>
            <div style="font-size:22px;font-weight:900;color:#f8fafc;margin:4px 0;">184 / 200</div>
            <div style="height:4px;background:#1e293b;border-radius:999px;overflow:hidden;"><div style="width:92%;height:100%;background:#f59e0b;"></div></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;">
            <div style="font-size:12px;font-weight:700;color:#f8fafc;margin-bottom:10px;">Microservice Mesh Status</div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;">
              <div style="display:flex;justify-content:space-between;color:#cbd5e1;"><span>auth-api.prod</span><span style="color:#22c55e;">● OK (14ms)</span></div>
              <div style="display:flex;justify-content:space-between;color:#cbd5e1;"><span>billing-service.prod</span><span style="color:#22c55e;">● OK (28ms)</span></div>
              <div style="display:flex;justify-content:space-between;color:#cbd5e1;"><span>graphql-gateway.prod</span><span style="color:#22c55e;">● OK (8ms)</span></div>
              <div style="display:flex;justify-content:space-between;color:#cbd5e1;"><span>worker-sync.prod</span><span style="color:#f59e0b;">▲ High Load (120ms)</span></div>
            </div>
          </div>
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;font-family:monospace;font-size:11px;">
            <div style="font-size:12px;font-weight:700;color:#f8fafc;font-family:sans-serif;margin-bottom:10px;">Cluster Incident Log</div>
            <div style="color:#22c55e;">[11:40:12] Pod auto-scaled: worker-sync +2 replicas</div>
            <div style="color:#94a3b8;">[11:35:00] Ingress certificate renewed successfully</div>
            <div style="color:#38bdf8;">[11:20:18] Deployment release: v2.4.0 deployed to us-east-1</div>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-shell-admin-support",
    label: "Admin CRM & Ticket Helpdesk Shell",
    category: "layouts",
    desc: "Helpdesk queue switcher, SLA timers, customer detail & response thread",
    icon: Headset,
    content: `<div style="display:flex;width:100%;min-height:560px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:280px;border-right:1px solid #e2e8f0;background:#f8fafc;display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:14px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
          <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">Support Inboxes</div>
          <div style="display:flex;gap:4px;font-size:10px;font-weight:700;">
            <span style="background:#2563eb;color:#ffffff;padding:3px 8px;border-radius:4px;">Unassigned (14)</span>
            <span style="background:#e2e8f0;color:#475569;padding:3px 8px;border-radius:4px;">Mine (3)</span>
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;">
          <div style="padding:12px 14px;background:#eff6ff;border-left:3px solid #2563eb;border-bottom:1px solid #e2e8f0;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="background:#fee2e2;color:#991b1b;font-weight:800;font-size:9px;padding:1px 6px;border-radius:4px;">P1 URGENT</span>
              <span style="font-size:10px;color:#dc2626;font-weight:700;">⏱ 18m left</span>
            </div>
            <div style="font-size:12px;font-weight:700;color:#0f172a;">SSO Login redirect failing</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">Acme Corp • 4 min ago</div>
          </div>
          <div style="padding:12px 14px;border-bottom:1px solid #e2e8f0;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="background:#fef3c7;color:#92400e;font-weight:800;font-size:9px;padding:1px 6px;border-radius:4px;">P2 HIGH</span>
              <span style="font-size:10px;color:#64748b;">⏱ 2h left</span>
            </div>
            <div style="font-size:12px;font-weight:700;color:#0f172a;">Billing invoice tax ID update</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">TechCorp LLC • 22 min ago</div>
          </div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;background:#ffffff;">
        <header style="height:56px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:#0f172a;">Ticket #4819: SSO Login redirect failing</div>
            <div style="font-size:11px;color:#64748b;">Requester: devops@acme.com • Enterprise SLA Tier</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button style="padding:6px 12px;border:1px solid #cbd5e1;background:#ffffff;border-radius:6px;font-size:11px;cursor:pointer;">Assign ▾</button>
            <button style="padding:6px 14px;background:#16a34a;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Solve Ticket</button>
          </div>
        </header>
        <div style="flex:1;padding:24px;overflow-y:auto;box-sizing:border-box;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
            <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;">Customer Message — 11:32 AM</div>
            <p style="font-size:12px;color:#334155;line-height:1.6;margin:0;">"Our Okta SAML 2.0 assertions are returning 403 on the callback endpoint since 11:00 AM. Please verify the IdP certificate."</p>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:14px;">
            <div style="display:flex;gap:12px;font-size:11px;font-weight:700;color:#64748b;margin-bottom:10px;">
              <span style="color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:4px;">Public Reply</span>
              <span>Internal Note</span>
            </div>
            <textarea placeholder="Type response to customer..." style="width:100%;height:80px;border:1px solid #e2e8f0;border-radius:6px;padding:8px;font-size:12px;box-sizing:border-box;"></textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:10px;">
              <button style="padding:6px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Send Reply</button>
            </div>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-shell-sidenav-topbar",
    label: "Side Nav & Top App Bar Shell",
    category: "layouts",
    desc: "Primary left side navigation bar + top app bar with breadcrumbs, search & user menu",
    icon: PanelLeft,
    content: `<div style="display:flex;width:100%;min-height:580px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <aside style="width:240px;background:#ffffff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;flex-shrink:0;">
        <div style="height:56px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:26px;height:26px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:13px;">N</div>
            <div>
              <div style="font-weight:800;font-size:13px;color:#0f172a;line-height:1.1;">Notely Studio</div>
              <div style="font-size:9px;color:#94a3b8;font-weight:600;">WORKSPACE v2.4</div>
            </div>
          </div>
          <span style="font-size:10px;background:#eff6ff;color:#2563eb;font-weight:700;padding:2px 6px;border-radius:4px;">PRO</span>
        </div>
        <div style="padding:16px 12px;flex:1;display:flex;flex-direction:column;gap:18px;overflow-y:auto;">
          <div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;padding:0 8px;margin-bottom:6px;">Main Menu</div>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;">
              <div style="background:#eff6ff;color:#2563eb;font-weight:700;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>📊</span> Overview
              </div>
              <div style="color:#475569;font-weight:500;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>📁</span> Projects
              </div>
              <div style="color:#475569;font-weight:500;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>📈</span> Analytics
              </div>
              <div style="color:#475569;font-weight:500;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>👥</span> Customers
              </div>
            </div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;padding:0 8px;margin-bottom:6px;">System & Admin</div>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;">
              <div style="color:#475569;font-weight:500;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>🔌</span> Integrations
              </div>
              <div style="color:#475569;font-weight:500;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>📖</span> Documentation
              </div>
              <div style="color:#475569;font-weight:500;padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:10px;">
                <span>⚙️</span> Settings
              </div>
            </div>
          </div>
        </div>
        <div style="padding:12px 14px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:999px;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">JD</div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#0f172a;">Jane Doe</div>
              <div style="font-size:9px;color:#94a3b8;">admin@notely.app</div>
            </div>
          </div>
          <span style="font-size:12px;color:#94a3b8;cursor:pointer;">⇥</span>
        </div>
      </aside>
      <div style="flex:1;display:flex;flex-direction:column;">
        <header style="height:56px;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <button style="border:none;background:transparent;color:#64748b;font-size:16px;cursor:pointer;padding:4px;">☰</button>
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;">
              <span>Workspaces</span><span>/</span>
              <span>Production</span><span>/</span>
              <span style="font-weight:700;color:#0f172a;">Overview</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="position:relative;display:flex;align-items:center;">
              <input type="text" placeholder="Search anything... (Ctrl+K)" style="padding:6px 14px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;width:220px;background:#f8fafc;" />
            </div>
            <div style="width:30px;height:30px;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff;display:flex;align-items:center;justify-content:center;color:#475569;font-size:13px;cursor:pointer;position:relative;">
              <span>🔔</span>
              <span style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;background:#ef4444;border-radius:999px;border:2px solid #ffffff;"></span>
            </div>
            <button style="padding:6px 12px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">+ Create</button>
          </div>
        </header>
        <main style="flex:1;padding:24px;display:flex;flex-direction:column;gap:20px;overflow-y:auto;box-sizing:border-box;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 4px;">Project Overview</h2>
              <p style="font-size:12px;color:#64748b;margin:0;">Manage and monitor active production services and teams.</p>
            </div>
            <div style="display:flex;gap:8px;">
              <button style="padding:6px 12px;border:1px solid #cbd5e1;background:#ffffff;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Filter</button>
              <button style="padding:6px 12px;background:#0f172a;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Download Report</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:14px;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;">TOTAL REVENUE</div>
              <div style="font-size:22px;font-weight:900;color:#0f172a;margin-top:4px;">$48,290</div>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;">ACTIVE SESSIONS</div>
              <div style="font-size:22px;font-weight:900;color:#0f172a;margin-top:4px;">1,429</div>
            </div>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="font-size:10px;font-weight:700;color:#64748b;">SYSTEM STATUS</div>
              <div style="font-size:14px;font-weight:800;color:#16a34a;margin-top:8px;">● All Services Up</div>
            </div>
          </div>
          <div style="border:2px dashed #cbd5e1;border-radius:8px;min-height:220px;background:#ffffff;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">
            Main Content Area (Tables, Wireframe Blocks, or Dashboard Cards)
          </div>
        </main>
      </div>
    </div>`
  },
  {
    id: "wf-shell-compact-sidenav-topbar",
    label: "Compact Icon Rail & Top App Bar",
    category: "layouts",
    desc: "64px slim icon rail + topbar navigation maximizing canvas content width",
    icon: Menu,
    content: `<div style="display:flex;width:100%;min-height:540px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <aside style="width:60px;background:#0f172a;color:#ffffff;display:flex;flex-direction:column;align-items:center;padding:16px 0;gap:20px;flex-shrink:0;">
        <div style="width:32px;height:32px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;">N</div>
        <div style="display:flex;flex-direction:column;gap:12px;font-size:16px;color:#94a3b8;">
          <div style="width:36px;height:36px;background:#2563eb;color:#ffffff;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;">📊</div>
          <div style="width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;">📁</div>
          <div style="width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;">📈</div>
          <div style="width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;">👥</div>
        </div>
        <div style="margin-top:auto;width:30px;height:30px;border-radius:999px;background:#334155;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">JD</div>
      </aside>
      <div style="flex:1;display:flex;flex-direction:column;">
        <header style="height:52px;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 20px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;">Application Workspace</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="text" placeholder="Search..." style="padding:5px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;width:160px;" />
            <button style="padding:5px 12px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;">+ New</button>
          </div>
        </header>
        <main style="flex:1;padding:20px;box-sizing:border-box;">
          <div style="border:2px dashed #cbd5e1;border-radius:8px;min-height:380px;background:#ffffff;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;">
            Expanded High-Density Canvas Area
          </div>
        </main>
      </div>
    </div>`
  }
];
