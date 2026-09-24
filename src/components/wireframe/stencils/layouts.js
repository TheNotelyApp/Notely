import {
  Layout,
  LayoutDashboard,
  LayoutGrid,
  Columns,
  Sidebar,
  Split,
  PanelsTopLeft,
  FileText,
  Compass,
  ShoppingBag,
  Sliders,
  Smartphone,
  Trello,
  Layers,
  Gauge,
  CheckSquare
} from "lucide-react";

export const layoutStencils = [
  {
    id: "wf-layout-3col-dashboard",
    label: "3-Column Workspace",
    category: "layouts",
    desc: "Navigation rail + central main workspace + right activity pane",
    icon: PanelsTopLeft,
    content: `<div style="display:flex;width:100%;min-height:520px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:200px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:16px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
        <div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span style="width:14px;height:14px;background:#2563eb;border-radius:3px;display:inline-block;"></span> App Nav
        </div>
        <div style="background:#e0e7ff;color:#3730a3;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;">Workspace</div>
        <div style="color:#64748b;padding:6px 10px;border-radius:6px;font-size:11px;">Reports</div>
        <div style="color:#64748b;padding:6px 10px;border-radius:6px;font-size:11px;">Documents</div>
        <div style="color:#64748b;padding:6px 10px;border-radius:6px;font-size:11px;margin-top:auto;">Settings</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;background:#ffffff;padding:20px;overflow-y:auto;box-sizing:border-box;">
        <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;">Central Workspace</div>
        <p style="font-size:12px;color:#64748b;margin:0 0 16px;">Main content stage, tables, or document body.</p>
        <div style="border:2px dashed #e2e8f0;border-radius:8px;padding:48px 24px;text-align:center;color:#94a3b8;font-size:12px;flex:1;display:flex;align-items:center;justify-content:center;">
          Main Stage Area
        </div>
      </div>
      <div style="width:230px;background:#f8fafc;border-left:1px solid #e2e8f0;padding:16px;display:flex;flex-direction:column;gap:12px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Context & Activity</div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-size:11px;color:#475569;">
          <div style="font-weight:600;color:#0f172a;margin-bottom:2px;">Recent Updates</div>
          <div>3 notes modified today</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-size:11px;color:#475569;">
          <div style="font-weight:600;color:#0f172a;margin-bottom:2px;">Collaborators</div>
          <div>2 active members</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-holy-grail",
    label: "Holy Grail Web Layout",
    category: "layouts",
    desc: "Header + Left sidebar + Main canvas + Right aside + Footer",
    icon: Layout,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:500px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <header style="height:48px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font-size:12px;font-weight:600;">
        <span>Site Header & Brand</span>
        <div style="display:flex;gap:14px;color:#94a3b8;font-size:11px;">
          <span>Docs</span>
          <span>API</span>
          <span>Community</span>
        </div>
      </header>
      <div style="display:flex;flex:1;">
        <nav style="width:180px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:16px;font-size:11px;color:#64748b;display:flex;flex-direction:column;gap:8px;">
          <div style="font-weight:700;color:#0f172a;">Navigation</div>
          <div>Getting Started</div>
          <div>Components</div>
          <div>Themes</div>
        </nav>
        <main style="flex:1;padding:24px;background:#ffffff;box-sizing:border-box;">
          <h2 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;">Main Article Content</h2>
          <p style="font-size:12px;color:#64748b;line-height:1.6;margin:0 0 16px;">Standard responsive Holy Grail layout pattern with full multi-column distribution.</p>
          <div style="border:1px dashed #cbd5e1;border-radius:6px;height:160px;background:#fafafa;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">Content Body Placeholder</div>
        </main>
        <aside style="width:190px;background:#f8fafc;border-left:1px solid #e2e8f0;padding:16px;font-size:11px;color:#64748b;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:8px;">On This Page</div>
          <div style="color:#2563eb;margin-bottom:4px;">Introduction</div>
          <div style="margin-bottom:4px;">Installation</div>
          <div>Usage Guidelines</div>
        </aside>
      </div>
      <footer style="height:38px;background:#f1f5f9;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font-size:10px;color:#64748b;">
        <span>© 2026 Wireframe Design. All rights reserved.</span>
        <span>Privacy • Terms • Status</span>
      </footer>
    </div>`
  },
  {
    id: "wf-layout-master-detail",
    label: "Master-Detail Inbox Split",
    category: "layouts",
    desc: "Searchable master item list on left + detail reading pane on right",
    icon: Split,
    content: `<div style="display:flex;width:100%;min-height:440px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:280px;border-right:1px solid #e2e8f0;background:#f8fafc;display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:12px;border-bottom:1px solid #e2e8f0;">
          <input type="text" placeholder="Search items..." style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;" />
        </div>
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;">
          <div style="padding:12px;background:#eff6ff;border-left:3px solid #2563eb;border-bottom:1px solid #e2e8f0;cursor:pointer;">
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px;">Design System Sync</div>
            <div style="font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Updated typography tokens and card heights...</div>
          </div>
          <div style="padding:12px;border-bottom:1px solid #e2e8f0;cursor:pointer;">
            <div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:2px;">Sprint Review Notes</div>
            <div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Wireframe studio testing is now 100% complete...</div>
          </div>
          <div style="padding:12px;border-bottom:1px solid #e2e8f0;cursor:pointer;">
            <div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:2px;">Export Capabilities</div>
            <div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Direct SVG to PNG renderer support added...</div>
          </div>
        </div>
      </div>
      <div style="flex:1;padding:24px;display:flex;flex-direction:column;background:#ffffff;box-sizing:border-box;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #f1f5f9;padding-bottom:14px;margin-bottom:16px;">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 4px;">Design System Sync</h3>
            <div style="font-size:11px;color:#64748b;">From: Sarah Jenkins • 10:42 AM Today</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button style="padding:5px 10px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;font-size:11px;cursor:pointer;">Archive</button>
            <button style="padding:5px 10px;border:none;background:#2563eb;color:#ffffff;border-radius:4px;font-size:11px;cursor:pointer;">Reply</button>
          </div>
        </div>
        <p style="font-size:12px;color:#334155;line-height:1.6;margin:0 0 12px;">We just rolled out the modularized stencil library and normalized all toolbar icon heights across the entire studio.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;font-size:11px;color:#64748b;">Selected detail pane preview</div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-document-canvas",
    label: "Centered Document / Canvas",
    category: "layouts",
    desc: "Notion / Medium style centered reading & writing layout",
    icon: FileText,
    content: `<div style="max-width:760px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:48px 40px;box-shadow:0 4px 16px rgba(0,0,0,0.03);box-sizing:border-box;">
      <div style="font-size:32px;margin-bottom:16px;">📝</div>
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin:0 0 12px;line-height:1.2;">Product Architecture & Specs</h1>
      <div style="display:flex;gap:8px;font-size:11px;color:#64748b;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #f1f5f9;">
        <span style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-weight:600;">Engineering</span>
        <span style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-weight:600;">Draft v1.4</span>
        <span style="color:#94a3b8;">Updated 2 hours ago</span>
      </div>
      <p style="font-size:13px;line-height:1.7;color:#334155;margin:0 0 16px;">This document captures the end-to-end user experience, wireframe component hierarchy, and offline storage models.</p>
      <div style="border-left:3px solid #2563eb;padding:10px 16px;background:#f8fafc;margin:16px 0;font-size:12px;color:#475569;font-style:italic;">
        "Great design is making something memorable and meaningful."
      </div>
      <div style="height:120px;border:1px dashed #cbd5e1;border-radius:6px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;margin-top:20px;">
        Add document blocks, images, or callouts here
      </div>
    </div>`
  },
  {
    id: "wf-layout-grid-4col",
    label: "4-Column Dashboard Grid",
    category: "layouts",
    desc: "Balanced 4-column responsive grid layout with cards",
    icon: LayoutGrid,
    content: `<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;margin:20px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Column 1</div>
        <div style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0;">Card Alpha</div>
        <p style="font-size:11px;color:#64748b;margin:0;">Flexible metric or feature card block.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Column 2</div>
        <div style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0;">Card Beta</div>
        <p style="font-size:11px;color:#64748b;margin:0;">Flexible metric or feature card block.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Column 3</div>
        <div style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0;">Card Gamma</div>
        <p style="font-size:11px;color:#64748b;margin:0;">Flexible metric or feature card block.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Column 4</div>
        <div style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0;">Card Delta</div>
        <p style="font-size:11px;color:#64748b;margin:0;">Flexible metric or feature card block.</p>
      </div>
    </div>`
  },
  {
    id: "wf-layout-docs-wiki",
    label: "Docs & Knowledge Wiki",
    category: "layouts",
    desc: "Sidebar navigation tree + markdown body + right table of contents",
    icon: Sidebar,
    content: `<div style="display:flex;width:100%;min-height:460px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:210px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:18px 14px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:10px;">Documentation</div>
        <div style="font-size:12px;font-weight:600;color:#2563eb;margin-bottom:8px;padding-left:6px;border-left:2px solid #2563eb;">Overview</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px;padding-left:8px;">Architecture</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px;padding-left:8px;">Design Tokens</div>
        <div style="font-size:12px;color:#64748b;padding-left:8px;">Component API</div>
      </div>
      <div style="flex:1;padding:28px;background:#ffffff;box-sizing:border-box;">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">Docs / Core Systems / Overview</div>
        <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 10px;">System Overview</h2>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin:0 0 14px;">The wireframe subsystem provides offline-first, native note integrations with vector precision.</p>
        <div style="background:#0f172a;color:#f8fafc;padding:12px 16px;border-radius:6px;font-family:monospace;font-size:11px;margin-bottom:16px;">
          npm run dev:wireframes
        </div>
      </div>
      <div style="width:170px;background:#ffffff;border-left:1px solid #f1f5f9;padding:18px 14px;flex-shrink:0;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:8px;">Sections</div>
        <div style="font-size:11px;color:#2563eb;margin-bottom:6px;">Architecture</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">Prerequisites</div>
        <div style="font-size:11px;color:#64748b;">Troubleshooting</div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-ecommerce-catalog",
    label: "E-Commerce Product Catalog",
    category: "layouts",
    desc: "Left faceted filter rail + top sort bar + 3-card product grid",
    icon: ShoppingBag,
    content: `<div style="display:flex;width:100%;min-height:480px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:210px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:18px 14px;flex-shrink:0;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:12px;">Filters</div>
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Category</div>
          <label style="display:block;font-size:11px;color:#334155;margin-bottom:4px;"><input type="checkbox" checked /> Hardware (14)</label>
          <label style="display:block;font-size:11px;color:#334155;margin-bottom:4px;"><input type="checkbox" /> Accessories (29)</label>
          <label style="display:block;font-size:11px;color:#334155;"><input type="checkbox" /> Software (8)</label>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Price Range</div>
          <div style="display:flex;gap:6px;">
            <input type="text" placeholder="$0" style="width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;" />
            <input type="text" placeholder="$500" style="width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;" />
          </div>
        </div>
      </div>
      <div style="flex:1;padding:20px;display:flex;flex-direction:column;background:#ffffff;box-sizing:border-box;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:12px;color:#64748b;font-weight:500;">Showing 1-12 of 48 items</span>
          <select style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;">
            <option>Sort by: Most Popular</option>
            <option>Price: Low to High</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:14px;flex:1;">
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;box-sizing:border-box;">
            <div style="height:90px;background:#f1f5f9;border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">Product 1</div>
            <div style="font-size:12px;font-weight:700;color:#0f172a;">Studio Monitor</div>
            <div style="font-size:11px;color:#2563eb;font-weight:600;margin-top:2px;">$299.00</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;box-sizing:border-box;">
            <div style="height:90px;background:#f1f5f9;border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">Product 2</div>
            <div style="font-size:12px;font-weight:700;color:#0f172a;">Mechanical Keyboard</div>
            <div style="font-size:11px;color:#2563eb;font-weight:600;margin-top:2px;">$129.00</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;box-sizing:border-box;">
            <div style="height:90px;background:#f1f5f9;border-radius:4px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">Product 3</div>
            <div style="font-size:12px;font-weight:700;color:#0f172a;">Wireless Trackpad</div>
            <div style="font-size:11px;color:#2563eb;font-weight:600;margin-top:2px;">$89.00</div>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-masonry-gallery",
    label: "Masonry Portfolio Gallery",
    category: "layouts",
    desc: "Staggered height card grid layout for visuals & media",
    icon: Columns,
    content: `<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin:20px 0;box-sizing:border-box;">
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="height:140px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:10px;">Visual 1</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Brand Identity Kit</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="height:90px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:10px;">Visual 2</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Icon Package</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="height:80px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:10px;">Visual 3</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Editorial Layout</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="height:150px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:10px;">Visual 4</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Mobile Dashboard UI</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="height:160px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:10px;">Visual 5</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Design System Showcase</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="height:70px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;margin-bottom:10px;">Visual 6</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Component Tokens</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-settings-portal",
    label: "Settings & Profile Portal",
    category: "layouts",
    desc: "Header banner + horizontal tabs + form content pane",
    icon: Sliders,
    content: `<div style="max-width:820px;margin:20px auto;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;box-sizing:border-box;">
      <div style="padding:24px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:16px;">
        <div style="width:52px;height:52px;border-radius:999px;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;">JD</div>
        <div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Jane Doe</div>
          <div style="font-size:11px;color:#64748b;">jane@company.com • Administrator</div>
        </div>
      </div>
      <div style="display:flex;border-bottom:1px solid #e2e8f0;padding:0 24px;background:#ffffff;">
        <div style="padding:10px 16px;font-size:12px;font-weight:700;color:#2563eb;border-bottom:2px solid #2563eb;">Account</div>
        <div style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:500;">Security</div>
        <div style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:500;">Billing</div>
        <div style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:500;">Integrations</div>
      </div>
      <div style="padding:28px 24px;box-sizing:border-box;">
        <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 4px;">Public Profile</h4>
        <p style="font-size:11px;color:#64748b;margin:0 0 18px;">This will be displayed on your technical documents.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">First Name</label>
            <input type="text" value="Jane" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Last Name</label>
            <input type="text" value="Doe" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;" />
          </div>
        </div>
        <button style="padding:7px 16px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Update Profile</button>
      </div>
    </div>`
  },
  {
    id: "wf-layout-social-feed",
    label: "Timeline & Activity Feed",
    category: "layouts",
    desc: "Centered post composer + stream cards + right trending rail",
    icon: Compass,
    content: `<div style="display:flex;gap:20px;max-width:920px;margin:20px auto;box-sizing:border-box;">
      <div style="flex:1;display:flex;flex-direction:column;gap:14px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;">
          <input type="text" placeholder="Share an update or question..." style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;margin-bottom:10px;box-sizing:border-box;" />
          <div style="display:flex;justify-content:flex-end;">
            <button style="padding:6px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Post</button>
          </div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.02);box-sizing:border-box;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:32px;height:32px;background:#e2e8f0;border-radius:999px;"></div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#0f172a;">Alex Morgan</div>
              <div style="font-size:10px;color:#94a3b8;">15m ago</div>
            </div>
          </div>
          <p style="font-size:12px;color:#334155;line-height:1.5;margin:0 0 12px;">Excited to announce the new modular wireframing stencils! Clean layout structures and zero clipping.</p>
          <div style="display:flex;gap:16px;font-size:11px;color:#64748b;">
            <span>👍 12 Likes</span>
            <span>💬 4 Comments</span>
            <span>↗ Share</span>
          </div>
        </div>
      </div>
      <div style="width:240px;display:flex;flex-direction:column;gap:14px;flex-shrink:0;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;box-sizing:border-box;">
          <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px;">Trending Topics</div>
          <div style="font-size:11px;color:#2563eb;margin-bottom:6px;">#DesignSystems</div>
          <div style="font-size:11px;color:#2563eb;margin-bottom:6px;">#WireframeStudio</div>
          <div style="font-size:11px;color:#2563eb;">#LocalFirst</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-wizard-stepper",
    label: "Multi-Step Onboarding Wizard",
    category: "layouts",
    desc: "Top step tracker + centered card stage + navigation footer",
    icon: CheckSquare,
    content: `<div style="max-width:680px;margin:24px auto;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,0.04);box-sizing:border-box;overflow:hidden;">
      <div style="padding:20px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:24px;height:24px;background:#2563eb;color:#ffffff;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">1</div>
          <span style="font-size:12px;font-weight:700;color:#0f172a;">Account</span>
        </div>
        <div style="width:40px;height:2px;background:#2563eb;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:24px;height:24px;background:#e2e8f0;color:#64748b;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">2</div>
          <span style="font-size:12px;color:#64748b;">Workspace</span>
        </div>
        <div style="width:40px;height:2px;background:#e2e8f0;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:24px;height:24px;background:#e2e8f0;color:#64748b;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">3</div>
          <span style="font-size:12px;color:#64748b;">Complete</span>
        </div>
      </div>
      <div style="padding:32px 28px;box-sizing:border-box;">
        <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0 0 6px;">Setup your organization</h3>
        <p style="font-size:12px;color:#64748b;margin:0 0 20px;">Provide basic details to configure your local space.</p>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Workspace Title</label>
          <input type="text" placeholder="e.g. Acme Studio" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Primary Industry</label>
          <select style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;">
            <option>Software & Product Design</option>
            <option>Research & Development</option>
          </select>
        </div>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <button style="padding:7px 14px;border:1px solid #cbd5e1;background:#ffffff;border-radius:6px;font-size:11px;cursor:pointer;">Previous</button>
        <button style="padding:7px 18px;border:none;background:#2563eb;color:#ffffff;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Next Step →</button>
      </div>
    </div>`
  },
  {
    id: "wf-layout-horizontal-split",
    label: "Horizontal Editor + Console",
    category: "layouts",
    desc: "Top editor viewport + draggable handle + bottom output drawer",
    icon: Layers,
    content: `<div style="display:flex;flex-direction:column;width:100%;min-height:480px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="height:36px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 14px;gap:8px;">
        <span style="width:10px;height:10px;border-radius:999px;background:#ef4444;display:inline-block;"></span>
        <span style="width:10px;height:10px;border-radius:999px;background:#f59e0b;display:inline-block;"></span>
        <span style="width:10px;height:10px;border-radius:999px;background:#10b981;display:inline-block;"></span>
        <span style="font-size:11px;font-weight:600;color:#64748b;margin-left:8px;">main.ts</span>
      </div>
      <div style="flex:1;padding:20px;font-family:monospace;font-size:12px;color:#334155;background:#ffffff;box-sizing:border-box;">
        <div>import { WireframeEditor } from "./WireframeEditor";</div>
        <div style="color:#94a3b8;margin-top:6px;">// Editor surface content placeholder</div>
      </div>
      <div style="height:6px;background:#e2e8f0;cursor:row-resize;display:flex;align-items:center;justify-content:center;">
        <span style="width:32px;height:2px;background:#94a3b8;border-radius:2px;"></span>
      </div>
      <div style="height:150px;background:#0f172a;color:#f8fafc;padding:14px 18px;font-family:monospace;font-size:11px;overflow-y:auto;box-sizing:border-box;">
        <div style="color:#22c55e;">[Ready] Compilation successful in 240ms</div>
        <div style="color:#94a3b8;">Listening on port 5173...</div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-kanban-board",
    label: "4-Column Kanban Swimlanes",
    category: "layouts",
    desc: "Backlog, In Progress, Review, and Done column board layout",
    icon: Trello,
    content: `<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:14px;margin:20px 0;box-sizing:border-box;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-sizing:border-box;">
        <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:10px;display:flex;justify-content:space-between;">
          <span>Backlog</span><span style="background:#e2e8f0;padding:1px 6px;border-radius:999px;font-size:10px;">3</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:8px;font-size:11px;font-weight:600;color:#0f172a;">Design audit tokens</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-sizing:border-box;">
        <div style="font-size:11px;font-weight:700;color:#2563eb;margin-bottom:10px;display:flex;justify-content:space-between;">
          <span>In Progress</span><span style="background:#dbeafe;padding:1px 6px;border-radius:999px;font-size:10px;">2</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:8px;font-size:11px;font-weight:600;color:#0f172a;">Modular layout stencils</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-sizing:border-box;">
        <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:10px;display:flex;justify-content:space-between;">
          <span>Review</span><span style="background:#fef3c7;padding:1px 6px;border-radius:999px;font-size:10px;">1</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:8px;font-size:11px;font-weight:600;color:#0f172a;">Icon scale compliance</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-sizing:border-box;">
        <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:10px;display:flex;justify-content:space-between;">
          <span>Done</span><span style="background:#dcfce7;padding:1px 6px;border-radius:999px;font-size:10px;">8</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:8px;font-size:11px;font-weight:600;color:#0f172a;">Header button alignment</div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-hero-zigzag",
    label: "Zig-Zag Feature Showcase",
    category: "layouts",
    desc: "Alternating 2-column image/text marketing layout rows",
    icon: LayoutDashboard,
    content: `<div style="display:flex;flex-direction:column;gap:32px;margin:24px 0;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:24px;">
        <div style="flex:1;background:#f1f5f9;height:180px;border-radius:8px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">Feature Visual Left</div>
        <div style="flex:1;">
          <span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;">Capability 01</span>
          <h3 style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0 10px;">Drag-and-Drop Speed</h3>
          <p style="font-size:12px;color:#64748b;line-height:1.6;margin:0;">Instant drag interaction with pre-calibrated stencils for wireframing at lightspeed.</p>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:24px;">
        <div style="flex:1;">
          <span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;">Capability 02</span>
          <h3 style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0 10px;">Local Privacy</h3>
          <p style="font-size:12px;color:#64748b;line-height:1.6;margin:0;">All designs and vector assets persist directly alongside notes in your local disk.</p>
        </div>
        <div style="flex:1;background:#f1f5f9;height:180px;border-radius:8px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">Feature Visual Right</div>
      </div>
    </div>`
  },
  {
    id: "wf-layout-mobile-screen",
    label: "Mobile App Screen with Bottom Nav",
    category: "layouts",
    desc: "Complete smartphone viewport with header and 5-tab bottom navigation",
    icon: Smartphone,
    content: `<div style="width:375px;min-height:640px;background:#ffffff;border:2px solid #1e293b;border-radius:12px;display:flex;flex-direction:column;margin:20px auto;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.12);box-sizing:border-box;">
      <div style="height:44px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-size:11px;font-weight:700;">
        <span>9:41</span>
        <span>Mobile App</span>
        <span>100% 🔋</span>
      </div>
      <div style="flex:1;padding:16px;background:#f8fafc;display:flex;flex-direction:column;gap:12px;overflow-y:auto;box-sizing:border-box;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">Today's Feed</div>
          <div style="font-size:11px;color:#64748b;">3 new wireframes updated</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">Quick Actions</div>
          <div style="font-size:11px;color:#64748b;">Create new project or export PNG</div>
        </div>
      </div>
      <div style="height:52px;background:#ffffff;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-around;font-size:10px;font-weight:600;color:#64748b;">
        <span style="color:#2563eb;">🏠 Home</span>
        <span>🔍 Search</span>
        <span>➕ New</span>
        <span>🔔 Alerts</span>
        <span>👤 Profile</span>
      </div>
    </div>`
  },
  {
    id: "wf-layout-analytics-dashboard",
    label: "Executive Analytics Overview",
    category: "layouts",
    desc: "Top date filter + 4 KPI stat cards + wide trend chart + 2-col lower split",
    icon: Gauge,
    content: `<div style="display:flex;flex-direction:column;gap:16px;margin:20px 0;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 18px;">
        <span style="font-size:13px;font-weight:700;color:#0f172a;">Executive Analytics Overview</span>
        <span style="font-size:11px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:4px;">Last 30 Days ▾</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="font-size:10px;color:#64748b;font-weight:700;">TOTAL REVENUE</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">$48,290</div>
          <div style="font-size:10px;color:#16a34a;font-weight:600;">+12.4% vs last mo</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="font-size:10px;color:#64748b;font-weight:700;">ACTIVE USERS</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">3,842</div>
          <div style="font-size:10px;color:#16a34a;font-weight:600;">+8.1% vs last mo</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="font-size:10px;color:#64748b;font-weight:700;">CONVERSION RATE</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">4.6%</div>
          <div style="font-size:10px;color:#dc2626;font-weight:600;">-0.3% vs last mo</div>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="font-size:10px;color:#64748b;font-weight:700;">NPS SCORE</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin:4px 0;">72</div>
          <div style="font-size:10px;color:#16a34a;font-weight:600;">Top 5% quartile</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;min-height:200px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#94a3b8;font-size:12px;border:1px dashed #cbd5e1;">
          Wide Performance Trend Chart
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:18px;min-height:200px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#94a3b8;font-size:12px;border:1px dashed #cbd5e1;">
          Distribution Donut / Breakdown
        </div>
      </div>
    </div>`
  }
];
