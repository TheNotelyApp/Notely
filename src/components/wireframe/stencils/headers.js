import { Box, Layout, AlignLeft, Compass, Smartphone } from "lucide-react";

export const headerStencils = [
  {
    id: "wf-nav-modern",
    label: "Modern SaaS Navbar",
    category: "headers",
    desc: "Logo, pill links, search & CTA buttons",
    icon: Box,
    content: `<header style="display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:12px 0;box-shadow:0 2px 6px rgba(0,0,0,0.03);box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:28px;">
        <div style="font-weight:800;font-size:15px;color:#0f172a;display:flex;align-items:center;gap:8px;">
          <span style="width:18px;height:18px;background:#2563eb;border-radius:4px;display:inline-block;"></span> Brand
        </div>
        <nav style="display:flex;gap:18px;font-size:13px;font-weight:500;color:#64748b;">
          <span style="color:#0f172a;font-weight:600;cursor:pointer;">Product</span>
          <span style="cursor:pointer;">Features</span>
          <span style="cursor:pointer;">Pricing</span>
          <span style="cursor:pointer;">Documentation</span>
        </nav>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button style="padding:8px 16px;border:1px solid #cbd5e1;border-radius:6px;background:#ffffff;font-size:12px;font-weight:600;color:#334155;cursor:pointer;">Sign in</button>
        <button style="padding:8px 18px;border:none;border-radius:6px;background:#2563eb;color:#ffffff;font-size:12px;font-weight:600;cursor:pointer;">Get Started</button>
      </div>
    </header>`
  },
  {
    id: "wf-segmented-tabs",
    label: "Segmented Control Tabs",
    category: "headers",
    desc: "Pill segmented navigation bar",
    icon: Layout,
    content: `<div style="display:inline-flex;background:#f1f5f9;padding:4px;border-radius:8px;border:1px solid #e2e8f0;gap:2px;margin:8px 0;">
      <button style="padding:6px 18px;border:none;background:#ffffff;color:#0f172a;font-size:12px;font-weight:600;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;">Design</button>
      <button style="padding:6px 18px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:500;border-radius:6px;cursor:pointer;">Prototype</button>
      <button style="padding:6px 18px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:500;border-radius:6px;cursor:pointer;">Inspect</button>
    </div>`
  },
  {
    id: "wf-page-header",
    label: "Page Header with Actions",
    category: "headers",
    desc: "Title, breadcrumb, live badge and button controls",
    icon: AlignLeft,
    content: `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #e2e8f0;margin-bottom:20px;box-sizing:border-box;">
      <div>
        <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;display:flex;gap:6px;">
          <span>Workspace</span><span>/</span><span style="color:#0f172a;">Settings</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0;">Project Configuration</h1>
          <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">Live</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button style="padding:8px 16px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Export</button>
        <button style="padding:8px 16px;border:none;background:#2563eb;color:#ffffff;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Save Changes</button>
      </div>
    </div>`
  },
  {
    id: "wf-breadcrumb-bar",
    label: "Breadcrumb Navigation Bar",
    category: "headers",
    desc: "Hierarchical trail with active note indicator",
    icon: Compass,
    content: `<nav style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:10px 0;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#64748b;">
        <span style="color:#2563eb;font-weight:600;cursor:pointer;">Workspace</span>
        <span>/</span>
        <span style="color:#2563eb;font-weight:600;cursor:pointer;">Engineering</span>
        <span>/</span>
        <span style="color:#0f172a;font-weight:700;">Architecture Docs</span>
      </div>
      <span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">v2.0</span>
    </nav>`
  },
  {
    id: "wf-mobile-bottom-tabs",
    label: "Mobile Bottom Navigation",
    category: "headers",
    desc: "4-icon mobile tab bar with active highlights",
    icon: Smartphone,
    content: `<div style="max-width:375px;margin:16px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;display:flex;justify-content:space-around;align-items:center;box-shadow:0 -2px 10px rgba(0,0,0,0.03);box-sizing:border-box;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:#2563eb;font-size:10px;font-weight:700;cursor:pointer;">
        <span style="font-size:15px;">🏠</span> Home
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:#64748b;font-size:10px;font-weight:500;cursor:pointer;">
        <span style="font-size:15px;">🔍</span> Search
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:#64748b;font-size:10px;font-weight:500;cursor:pointer;">
        <span style="font-size:15px;">⚡</span> Activity
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:#64748b;font-size:10px;font-weight:500;cursor:pointer;">
        <span style="font-size:15px;">👤</span> Profile
      </div>
    </div>`
  }
];
