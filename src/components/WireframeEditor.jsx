import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Save,
  X,
  Download,
  Search,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Trash2,
  Eye,
  EyeOff,
  Grid3X3,
  Layers,
  Palette,
  Layout,
  Square,
  Box,
  Sliders,
  Sparkles,
  MousePointer,
  Plus,
} from "lucide-react";
import OverlayDialog from "./OverlayDialog";
import useConfirm from "../hooks/useConfirm";
import { writeWireframeSource, writeWireframeImage } from "../services/wireframeService";
import { runExport } from "../services/electronService";
import "../styles/ExcalidrawEditor.css";
import "../styles/WireframeEditor.css";


// â”€â”€ Figma-inspired Component Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORIES = [
  { id: "all", label: "All Stencils" },
  { id: "frames", label: "Artboards & Frames", icon: Layout },
  { id: "headers", label: "Headers & Nav", icon: Box },
  { id: "hero", label: "Hero Sections", icon: Sparkles },
  { id: "content", label: "Content & Grids", icon: Grid3X3 },
  { id: "components", label: "UI Components", icon: Square },
  { id: "forms", label: "Forms & Inputs", icon: Sliders },
  { id: "tables", label: "Data & Tables", icon: Layers },
  { id: "feedback", label: "Modals & Feedback", icon: MousePointer },
];

const FIGMA_STENCILS = [
  // â”€â”€ Artboards & Frames â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-desktop-canvas",
    label: "Desktop Canvas",
    category: "frames",
    desc: "1200px responsive frame with padding",
    icon: "ðŸ–¥ï¸",
    content: `<div style="max-width:1140px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,0.06);min-height:600px;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:24px;border-bottom:1px dashed #cbd5e1;padding-bottom:10px;">Desktop Screen Artboard</div>
    </div>`,
  },
  {
    id: "wf-mobile-device",
    label: "Mobile iPhone Frame",
    category: "frames",
    desc: "375x812px mobile frame with notch",
    icon: "ðŸ“±",
    content: `<div style="width:375px;min-height:720px;background:#ffffff;border:3px solid #1e293b;border-radius:36px;padding:24px 18px;margin:24px auto;box-shadow:0 20px 50px rgba(0,0,0,0.15);position:relative;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;">
      <div style="width:130px;height:22px;background:#0f172a;border-radius:0 0 14px 14px;margin:-24px auto 20px;display:flex;align-items:center;justify-content:center;">
        <span style="width:40px;height:4px;background:#334155;border-radius:999px;"></span>
      </div>
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-align:center;margin-bottom:16px;letter-spacing:0.05em;text-transform:uppercase;">Mobile Viewport</div>
    </div>`,
  },
  {
    id: "wf-app-shell",
    label: "SaaS Dashboard Shell",
    category: "frames",
    desc: "Left sidebar + topbar + main content",
    icon: "ðŸ”²",
    content: `<div style="display:flex;width:100%;min-height:500px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="width:230px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:20px 16px;display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;color:#0f172a;margin-bottom:20px;">
          <span style="width:20px;height:20px;background:#2563eb;border-radius:6px;display:inline-block;"></span> Notely App
        </div>
        <div style="background:#e0e7ff;color:#3730a3;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;">ðŸ“Š Dashboard</div>
        <div style="color:#64748b;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;">ðŸ“ Projects</div>
        <div style="color:#64748b;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;">ðŸ‘¥ Team</div>
        <div style="color:#64748b;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;margin-top:auto;">âš™ï¸ Settings</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;background:#ffffff;">
        <div style="height:56px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
          <span style="font-size:14px;font-weight:700;color:#0f172a;">Overview</span>
          <div style="width:32px;height:32px;background:#f1f5f9;border-radius:999px;border:1px solid #e2e8f0;"></div>
        </div>
        <div style="padding:24px;flex:1;background:#fafafa;">
          <div style="border:2px dashed #cbd5e1;border-radius:8px;padding:32px;text-align:center;color:#94a3b8;font-size:13px;">Drop dashboard widgets and cards here</div>
        </div>
      </div>
    </div>`,
  },

  // â”€â”€ Headers & Nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-nav-modern",
    label: "Modern SaaS Navbar",
    category: "headers",
    desc: "Logo, pill links, search & CTA buttons",
    icon: "ðŸ§­",
    content: `<header style="display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;margin:12px 0;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.03);box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:28px;">
        <div style="font-weight:800;font-size:16px;color:#0f172a;display:flex;align-items:center;gap:8px;">
          <span style="width:20px;height:20px;background:#2563eb;border-radius:6px;display:inline-block;"></span> Brand
        </div>
        <nav style="display:flex;gap:20px;font-size:13px;font-weight:500;color:#64748b;">
          <span style="color:#0f172a;font-weight:600;cursor:pointer;">Product</span>
          <span style="cursor:pointer;">Features</span>
          <span style="cursor:pointer;">Pricing</span>
          <span style="cursor:pointer;">Documentation</span>
        </nav>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <button style="padding:8px 16px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;font-size:12px;font-weight:600;color:#334155;cursor:pointer;">Sign in</button>
        <button style="padding:8px 18px;border:none;border-radius:8px;background:#2563eb;color:#ffffff;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(37,99,235,0.3);">Get Started</button>
      </div>
    </header>`,
  },
  {
    id: "wf-segmented-tabs",
    label: "Figma Segmented Control",
    category: "headers",
    desc: "iOS/Figma style pill segmented tabs",
    icon: "ðŸ—‚ï¸",
    content: `<div style="display:inline-flex;background:#f1f5f9;padding:4px;border-radius:10px;border:1px solid #e2e8f0;gap:2px;font-family:system-ui,sans-serif;margin:8px 0;">
      <button style="padding:6px 18px;border:none;background:#ffffff;color:#0f172a;font-size:12px;font-weight:600;border-radius:7px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;">Design</button>
      <button style="padding:6px 18px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:500;border-radius:7px;cursor:pointer;">Prototype</button>
      <button style="padding:6px 18px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:500;border-radius:7px;cursor:pointer;">Inspect</button>
    </div>`,
  },
  {
    id: "wf-page-header",
    label: "Page Header with Actions",
    category: "headers",
    desc: "Title, breadcrumb, badge & action buttons",
    icon: "ðŸ”",
    content: `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #e2e8f0;margin-bottom:20px;font-family:system-ui,sans-serif;box-sizing:border-box;">
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
        <button style="padding:8px 16px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Export</button>
        <button style="padding:8px 16px;border:none;background:#2563eb;color:#ffffff;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Save Changes</button>
      </div>
    </div>`,
  },

  // â”€â”€ Hero Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-hero-centered",
    label: "Hero Centered Section",
    category: "hero",
    desc: "Headline, badge, CTA buttons & mockup frame",
    icon: "ðŸŒŸ",
    content: `<section style="text-align:center;padding:56px 24px;background:linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);border:1px solid #e2e8f0;border-radius:16px;margin:20px 0;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:16px;">
        <span>âœ¨</span> Just Released v2.0
      </div>
      <h1 style="font-size:36px;font-weight:900;color:#0f172a;margin:0 0 14px;letter-spacing:-0.03em;line-height:1.2;">Design systems that scale with ease</h1>
      <p style="font-size:15px;color:#64748b;max-width:560px;margin:0 auto 28px;line-height:1.6;">Create beautiful wireframes, mockups, and interface flows directly inside your documentation.</p>
      <div style="display:flex;justify-content:center;gap:12px;margin-bottom:40px;">
        <button style="padding:12px 28px;background:#2563eb;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,0.35);">Start for Free</button>
        <button style="padding:12px 24px;background:#ffffff;color:#334155;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Live Preview</button>
      </div>
      <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;height:240px;max-width:800px;margin:0 auto;box-shadow:0 20px 40px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:14px;font-weight:600;">
        [ App Preview Screen Mockup ]
      </div>
    </section>`,
  },
  {
    id: "wf-cta-banner",
    label: "Call to Action Banner",
    category: "hero",
    desc: "Dark accent conversion box with buttons",
    icon: "ðŸ“£",
    content: `<div style="background:#0f172a;border-radius:16px;padding:40px 36px;display:flex;align-items:center;justify-content:space-between;color:#ffffff;margin:24px 0;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div>
        <h2 style="font-size:24px;font-weight:800;margin:0 0 6px;letter-spacing:-0.02em;">Ready to upgrade your workflow?</h2>
        <p style="font-size:13px;color:#94a3b8;margin:0;max-width:480px;">Collaborate in real time with high-velocity interface components.</p>
      </div>
      <div style="display:flex;gap:12px;">
        <button style="padding:10px 22px;background:#2563eb;color:#ffffff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Get Started</button>
      </div>
    </div>`,
  },

  // â”€â”€ Content & Grids â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-feature-grid-3",
    label: "3-Column Feature Cards",
    category: "content",
    desc: "Feature icons with title and descriptions",
    icon: "ðŸ—ƒï¸",
    content: `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:20px;margin:20px 0;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="width:40px;height:40px;background:#eff6ff;color:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:16px;">âš¡</div>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 8px;">Lightning Fast</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0;">Instant drag-and-drop elements designed for rapid wireframing.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="width:40px;height:40px;background:#fdf2f8;color:#db2777;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:16px;">ðŸŽ¨</div>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 8px;">Figma Precision</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0;">Pixel-calibrated spacing, modern typography, and clean tokens.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <div style="width:40px;height:40px;background:#f0fdf4;color:#16a34a;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:16px;">ðŸ”’</div>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 8px;">Offline Native</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0;">100% saved locally alongside notes with instant export capabilities.</p>
      </div>
    </div>`,
  },
  {
    id: "wf-pricing-card-group",
    label: "Pricing Tier Cards",
    category: "content",
    desc: "Basic vs Pro pricing comparison tier",
    icon: "ðŸ·ï¸",
    content: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:680px;margin:24px auto;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Starter</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;margin:10px 0 16px;">$0<span style="font-size:14px;color:#94a3b8;font-weight:400;">/mo</span></div>
        <ul style="padding-left:0;list-style:none;font-size:12px;color:#475569;display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
          <li>âœ“ Up to 10 wireframes</li>
          <li>âœ“ Standard export (PNG)</li>
          <li>âœ“ Core component library</li>
        </ul>
        <button style="width:100%;padding:10px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Get Started</button>
      </div>
      <div style="background:#ffffff;border:2px solid #2563eb;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(37,99,235,0.12);position:relative;">
        <span style="position:absolute;top:-12px;right:24px;background:#2563eb;color:#ffffff;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;">Popular</span>
        <div style="font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;">Professional</div>
        <div style="font-size:32px;font-weight:900;color:#0f172a;margin:10px 0 16px;">$19<span style="font-size:14px;color:#94a3b8;font-weight:400;">/mo</span></div>
        <ul style="padding-left:0;list-style:none;font-size:12px;color:#475569;display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
          <li>âœ“ Unlimited wireframes</li>
          <li>âœ“ Vector & SVG export</li>
          <li>âœ“ Full UI stencil packs</li>
        </ul>
        <button style="width:100%;padding:10px;border:none;background:#2563eb;color:#ffffff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Upgrade to Pro</button>
      </div>
    </div>`,
  },
  {
    id: "wf-kpi-row",
    label: "Metric KPI Stats Row",
    category: "content",
    desc: "3 metric numbers with trends",
    icon: "ðŸ“ˆ",
    content: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin:16px 0;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Active Users</div>
        <div style="font-size:24px;font-weight:800;color:#0f172a;margin:6px 0 2px;">24,520</div>
        <div style="font-size:11px;color:#16a34a;font-weight:600;">â†‘ 14.8% <span style="color:#94a3b8;font-weight:400;">this week</span></div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Conversion Rate</div>
        <div style="font-size:24px;font-weight:800;color:#0f172a;margin:6px 0 2px;">3.84%</div>
        <div style="font-size:11px;color:#16a34a;font-weight:600;">â†‘ 2.1% <span style="color:#94a3b8;font-weight:400;">average</span></div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Total Notes</div>
        <div style="font-size:24px;font-weight:800;color:#0f172a;margin:6px 0 2px;">1,420</div>
        <div style="font-size:11px;color:#2563eb;font-weight:600;">â— Syncing <span style="color:#94a3b8;font-weight:400;">live</span></div>
      </div>
    </div>`,
  },

  // â”€â”€ UI Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-card-media",
    label: "Article / Media Card",
    category: "components",
    desc: "Post card with tag, author, title & image",
    icon: "ðŸƒ",
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;width:300px;box-shadow:0 4px 12px rgba(0,0,0,0.04);font-family:system-ui,sans-serif;margin:12px 0;">
      <div style="background:#cbd5e1;height:140px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px;font-weight:600;">[ Cover Photo ]</div>
      <div style="padding:18px;">
        <span style="font-size:10px;font-weight:800;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em;">Engineering</span>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:6px 0 8px;line-height:1.3;">Designing resilient distributed architectures</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0 0 16px;">Key architectural patterns for high-throughput node applications.</p>
        <div style="display:flex;align-items:center;gap:10px;border-top:1px solid #f1f5f9;padding-top:12px;">
          <div style="width:24px;height:24px;background:#e2e8f0;border-radius:999px;"></div>
          <span style="font-size:11px;color:#475569;font-weight:500;">David Kim Â· 5m read</span>
        </div>
      </div>
    </div>`,
  },
  {
    id: "wf-user-profile-widget",
    label: "User Profile Card",
    category: "components",
    desc: "Avatar, follower count, and follow button",
    icon: "ðŸ‘¤",
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;width:280px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);font-family:system-ui,sans-serif;margin:12px 0;">
      <div style="width:56px;height:56px;background:#e0e7ff;color:#3730a3;border-radius:999px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;">OK</div>
      <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 2px;">Sarah Jenkins</h3>
      <p style="font-size:11px;color:#64748b;margin:0 0 14px;">Senior Product Designer</p>
      <div style="display:flex;justify-content:space-around;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;padding:10px 0;margin-bottom:16px;">
        <div><div style="font-size:14px;font-weight:700;color:#0f172a;">128</div><div style="font-size:10px;color:#94a3b8;">Projects</div></div>
        <div><div style="font-size:14px;font-weight:700;color:#0f172a;">4.9k</div><div style="font-size:10px;color:#94a3b8;">Followers</div></div>
      </div>
      <button style="width:100%;padding:8px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Follow</button>
    </div>`,
  },

  // â”€â”€ Forms & Inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-modern-login-form",
    label: "Modern Auth Form",
    category: "forms",
    desc: "Clean login form with social sign-in",
    icon: "ðŸ”’",
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;width:340px;box-shadow:0 10px 25px rgba(0,0,0,0.05);font-family:system-ui,sans-serif;margin:16px auto;box-sizing:border-box;">
      <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 4px;">Welcome back</h2>
      <p style="font-size:12px;color:#64748b;margin:0 0 20px;">Enter your details to access your account</p>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="display:block;font-size:11px;font-weight:600;color:#334155;margin-bottom:4px;">Email</label>
          <input type="email" placeholder="name@domain.com" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;box-sizing:border-box;background:#f8fafc;" />
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <label style="font-size:11px;font-weight:600;color:#334155;">Password</label>
            <span style="font-size:11px;color:#2563eb;cursor:pointer;font-weight:500;">Forgot?</span>
          </div>
          <input type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;box-sizing:border-box;background:#f8fafc;" />
        </div>
        <button style="width:100%;padding:10px;background:#2563eb;color:#ffffff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;">Sign In</button>
      </div>
    </div>`,
  },
  {
    id: "wf-filter-panel",
    label: "Filter & Search Bar",
    category: "forms",
    desc: "Search bar, select dropdowns & view toggle",
    icon: "ðŸ”",
    content: `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0;font-family:system-ui,sans-serif;box-sizing:border-box;">
      <input type="text" placeholder="Filter records..." style="flex:1;max-width:300px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
      <div style="display:flex;gap:8px;">
        <select style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#ffffff;color:#334155;">
          <option>Status: All</option><option>Active</option><option>Archived</option>
        </select>
        <button style="padding:8px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">+ Add Item</button>
      </div>
    </div>`,
  },

  // â”€â”€ Data & Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-rich-table",
    label: "Figma Interactive Table",
    category: "tables",
    desc: "Zebra table with avatars, badges & checkboxes",
    icon: "ðŸ“Š",
    content: `<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#ffffff;font-family:system-ui,sans-serif;margin:16px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:700;">
            <th style="padding:12px 16px;width:30px;"><input type="checkbox" /></th>
            <th style="padding:12px 16px;">User</th>
            <th style="padding:12px 16px;">Role</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;"><input type="checkbox" /></td>
            <td style="padding:12px 16px;display:flex;align-items:center;gap:10px;">
              <div style="width:28px;height:28px;background:#e0e7ff;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#3730a3;font-size:11px;">EM</div>
              <div><div style="font-weight:700;color:#0f172a;">Elena Morales</div><div style="font-size:11px;color:#94a3b8;">elena@company.com</div></div>
            </td>
            <td style="padding:12px 16px;color:#475569;">Admin</td>
            <td style="padding:12px 16px;"><span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">Active</span></td>
            <td style="padding:12px 16px;text-align:right;color:#2563eb;font-weight:600;cursor:pointer;">Edit</td>
          </tr>
          <tr style="background:#fafafa;border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;"><input type="checkbox" /></td>
            <td style="padding:12px 16px;display:flex;align-items:center;gap:10px;">
              <div style="width:28px;height:28px;background:#fef3c7;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#b45309;font-size:11px;">TH</div>
              <div><div style="font-weight:700;color:#0f172a;">Thomas Hayes</div><div style="font-size:11px;color:#94a3b8;">thomas@company.com</div></div>
            </td>
            <td style="padding:12px 16px;color:#475569;">Editor</td>
            <td style="padding:12px 16px;"><span style="background:#fef9c3;color:#a16207;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">Pending</span></td>
            <td style="padding:12px 16px;text-align:right;color:#2563eb;font-weight:600;cursor:pointer;">Edit</td>
          </tr>
        </tbody>
      </table>
    </div>`,
  },

  // â”€â”€ Modals & Feedback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wf-modal-figma",
    label: "Figma Clean Dialog",
    category: "feedback",
    desc: "Centered popup with cancel/confirm buttons",
    icon: "ðŸªŸ",
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;max-width:400px;margin:24px auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.18);font-family:system-ui,sans-serif;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;">Publish Project Changes</h3>
        <span style="color:#94a3b8;cursor:pointer;font-size:16px;">âœ•</span>
      </div>
      <p style="font-size:13px;color:#64748b;line-height:1.5;margin:0 0 24px;">Your changes will immediately become visible to all team members collaborating in this workspace.</p>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button style="padding:8px 16px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Cancel</button>
        <button style="padding:8px 18px;border:none;background:#2563eb;color:#ffffff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Publish Now</button>
      </div>
    </div>`,
  },
  {
    id: "wf-toast-notification",
    label: "Toast Notification",
    category: "feedback",
    desc: "Floating success/info message pill",
    icon: "ðŸ””",
    content: `<div style="display:inline-flex;align-items:center;gap:12px;background:#0f172a;color:#ffffff;padding:12px 18px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:system-ui,sans-serif;font-size:12px;margin:12px 0;">
      <span style="color:#22c55e;font-size:15px;">âœ“</span>
      <span style="font-weight:500;">Document exported successfully to PNG.</span>
      <span style="color:#94a3b8;cursor:pointer;margin-left:8px;">âœ•</span>
    </div>`,
  },
];

// â”€â”€ Export SVG rasterizer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function exportWireframeToPng(editor) {
  return new Promise((resolve) => {
    try {
      if (!editor) {
        resolve(createFallbackPng(editor));
        return;
      }

      const html = editor.getHtml?.() || "";
      const css = editor.getCss?.() || "";

      const width = 1200;
      const height = 800;

      const svgDoc = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;width:${width}px;height:${height}px;box-sizing:border-box;overflow:hidden;font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <style>
                *, *::before, *::after { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #ffffff; }
                ${css}
              </style>
              <div style="padding:28px;">
                ${html}
              </div>
            </div>
          </foreignObject>
        </svg>
      `;

      const blob = new Blob([svgDoc], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          URL.revokeObjectURL(url);
          resolve(createFallbackPng(editor));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(createFallbackPng(editor));
      };

      img.src = url;
    } catch {
      resolve(createFallbackPng(editor));
    }
  });
}

function createFallbackPng(editor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1200, 800);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 1168, 768);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";

  const html = editor?.getHtml?.() || "";
  const hasContent = html.replace(/<[^>]+>/g, "").trim().length > 10;
  ctx.fillText(hasContent ? "Wireframe Mockup" : "Empty Wireframe", 600, 400);

  return canvas.toDataURL("image/png");
}

// â”€â”€ WireframeEditor Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function WireframeEditor({
  initialData,
  diagramId,
  documentPath,
  onClose,
  onSave,
  onNotify,
}) {
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const saveButtonRef = useRef(null);
  const { confirm } = useConfirm();

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Editor controls state
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDevice, setActiveDevice] = useState("Desktop");
  const [gridVisible, setGridVisible] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState("styles");

  const filteredStencils = useMemo(() => {
    return FIGMA_STENCILS.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleClose = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Discard Changes?",
        message: "You have unsaved wireframe changes. Are you sure you want to discard them?",
        confirmLabel: "Discard",
        cancelLabel: "Cancel",
        variant: "danger",
      });
      if (!confirmed) return;
    }
    onClose?.();
  }, [hasUnsavedChanges, onClose, confirm]);

  // Initialize GrapesJS
  useEffect(() => {
    if (!editorContainerRef.current || editorRef.current) return;

    let destroyed = false;

    async function initGrapesJS() {
      try {
        const grapesjs = (await import("grapesjs")).default;
        if (destroyed || !editorContainerRef.current) return;

        const editor = grapesjs.init({
          container: editorContainerRef.current,
          height: "100%",
          width: "100%",
          storageManager: false,
          undoManager: true,
          deviceManager: {
            devices: [
              { name: "Desktop", width: "" },
              { name: "Tablet", width: "768px" },
              { name: "Mobile", width: "375px" },
            ],
          },
          panels: { defaults: [] },
          styleManager: {
            appendTo: ".wireframe-sm-container",
            sectors: [
              {
                name: "Layout & Auto-Layout",
                open: true,
                properties: [
                  "display",
                  "flex-direction",
                  "justify-content",
                  "align-items",
                  "gap",
                  "padding",
                  "margin",
                  "width",
                  "max-width",
                  "min-height",
                ],
              },
              {
                name: "Typography",
                open: true,
                properties: [
                  "font-size",
                  "font-weight",
                  "color",
                  "text-align",
                  "line-height",
                ],
              },
              {
                name: "Fill & Stroke",
                open: true,
                properties: [
                  "background-color",
                  "border",
                  "border-radius",
                  "box-shadow",
                  "opacity",
                ],
              },
            ],
          },
          layerManager: {
            appendTo: ".wireframe-layers-container",
          },
          traitManager: {
            appendTo: ".wireframe-traits-container",
          },
          canvas: {
            styles: [
              `
              *, *::before, *::after { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 40px;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: #f8fafc;
                min-height: 100vh;
              }
              .gjs-selected {
                outline: 2px solid #7c6af7 !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 4px rgba(124,106,247,0.18) !important;
              }
              .gjs-hovered {
                outline: 1px dashed #a78bfa !important;
                outline-offset: 1px !important;
              }
            `,
            ],
          },

        });

        editorRef.current = editor;

        // Register components into BlockManager
        const bm = editor.BlockManager;
        FIGMA_STENCILS.forEach((stencil) => {
          bm.add(stencil.id, {
            label: stencil.label,
            category: stencil.category,
            content: stencil.content,
          });
        });

        // Load project data
        if (initialData) {
          try {
            const parsed = typeof initialData === "string" ? JSON.parse(initialData) : initialData;
            if (parsed && typeof parsed === "object") {
              editor.loadProjectData(parsed);
            } else if (typeof initialData === "string" && initialData.trim().startsWith("<")) {
              editor.setComponents(initialData);
            }
          } catch {
            // ignore malformed JSON
          }
        }

        // Track dirty state
        editor.on("component:add component:remove component:update style:change", () => {
          setHasUnsavedChanges(true);
        });

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize GrapesJS:", err);
        setIsLoading(false);
      }
    }

    void initGrapesJS();

    return () => {
      destroyed = true;
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  // Keyboard shortcut Ctrl+S
  const handleSaveRef = useRef(null);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Device switcher
  const handleSetDevice = (device) => {
    setActiveDevice(device);
    editorRef.current?.setDevice(device);
  };

  // Canvas Actions
  const handleUndo = () => editorRef.current?.UndoManager?.undo();
  const handleRedo = () => editorRef.current?.UndoManager?.redo();
  const handleClear = () => {
    if (window.confirm("Clear the current wireframe canvas?")) {
      editorRef.current?.runCommand("core:canvas-clear");
      setHasUnsavedChanges(true);
    }
  };

  const handleToggleBorders = () => {
    setGridVisible(!gridVisible);
    editorRef.current?.runCommand("sw-visibility");
  };

  // Direct component insertion onto canvas
  const handleInsertStencil = (stencil) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (selected) {
      selected.append(stencil.content);
    } else {
      editor.addComponents(stencil.content);
    }
    setHasUnsavedChanges(true);
  };

  // Save handler
  const handleSave = async () => {
    const editor = editorRef.current;
    if (!editor || isSaving) return;

    setIsSaving(true);
    try {
      const projectData = editor.getProjectData();
      const projectJson = JSON.stringify(projectData);

      const pngDataUrl = await exportWireframeToPng(editor);

      if (diagramId) {
        await writeWireframeSource(diagramId, projectJson, documentPath);
        if (pngDataUrl) {
          await writeWireframeImage(diagramId, pngDataUrl, documentPath);
        }
      }

      setHasUnsavedChanges(false);
      onSave?.(projectJson, pngDataUrl);
      onNotify?.("Wireframe saved successfully.", "success");
    } catch (err) {
      console.error("Failed to save wireframe:", err);
      onNotify?.(err?.message || "Failed to save wireframe.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Download handler
  const handleDownload = async () => {
    const editor = editorRef.current;
    if (!editor || isExporting) return;

    setIsExporting(true);
    try {
      const pngDataUrl = await exportWireframeToPng(editor);
      if (!pngDataUrl) {
        onNotify?.("Failed to generate wireframe image.", "error");
        return;
      }

      const filename = `${diagramId || "wireframe"}.png`;
      const result = await runExport("diagram_image", {
        dataUrl: pngDataUrl,
        filename,
        customExportType: "diagram_wireframe",
        category: "diagram",
      });

      if (result?.success) {
        onNotify?.(`Wireframe exported to ${result.filename}`, "success");
      } else {
        onNotify?.(result?.error || "Failed to export wireframe.", "error");
      }
    } catch (err) {
      console.error("Failed to download wireframe:", err);
      onNotify?.("Failed to export wireframe.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <OverlayDialog
      onClose={handleClose}
      closeOnClickOutside={false}
      ariaLabel="Wireframe Studio"
      overlayClassName="excalidraw-modal-overlay"
      cardClassName="excalidraw-modal-container wireframe-modal-container"
      useDefaultCardClass={false}
      size=""
      initialFocusRef={saveButtonRef}
    >
      {/* â”€â”€ Dark Figma-style Top Toolbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="wireframe-studio-header">
        {/* Brand */}
        <div className="wireframe-studio-title-group">
          <div className="wireframe-studio-logo">âœ¦</div>
          <div>
            <h2 className="wireframe-studio-title">Wireframe Studio</h2>
            <div className="wireframe-studio-subtitle">Visual UI Builder</div>
          </div>
        </div>

        <div className="wireframe-header-divider" />

        {/* Viewport switchers */}
        <div className="wireframe-viewport-controls">
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Desktop" ? "active" : ""}`}
            onClick={() => handleSetDevice("Desktop")}
            title="Desktop canvas"
          >
            <Monitor size={13} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Tablet" ? "active" : ""}`}
            onClick={() => handleSetDevice("Tablet")}
            title="Tablet (768px)"
          >
            <Tablet size={13} />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Mobile" ? "active" : ""}`}
            onClick={() => handleSetDevice("Mobile")}
            title="Mobile (375px)"
          >
            <Smartphone size={13} />
            <span>Mobile</span>
          </button>
        </div>

        <div className="wireframe-header-divider" />

        {/* Canvas tool icons */}
        <div className="wireframe-canvas-tools">
          <button
            type="button"
            className="wireframe-tool-icon-btn"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="wireframe-tool-icon-btn"
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          <span className="wireframe-tool-sep" />
          <button
            type="button"
            className={`wireframe-tool-icon-btn ${gridVisible ? "active" : ""}`}
            onClick={handleToggleBorders}
            title="Toggle Layout Bounds"
          >
            {gridVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            className="wireframe-tool-icon-btn danger"
            onClick={handleClear}
            title="Clear Canvas"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="wireframe-action-buttons">
          {hasUnsavedChanges && <span className="wf-unsaved-dot" title="Unsaved changes" />}
          <button
            type="button"
            className="wf-btn wf-btn-ghost"
            onClick={handleDownload}
            disabled={isSaving || isExporting || isLoading}
          >
            <Download size={13} />
            {isExporting ? "Exportingâ€¦" : "Export PNG"}
          </button>
          <button
            ref={saveButtonRef}
            type="button"
            className="wf-btn wf-btn-primary"
            onClick={handleSave}
            disabled={isSaving || isExporting || isLoading}
          >
            <Save size={13} />
            {isSaving ? "Savingâ€¦" : "Save"}
          </button>
          <button
            type="button"
            className="wf-btn wf-btn-ghost"
            onClick={handleClose}
            disabled={isSaving || isExporting}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* â”€â”€ Studio Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="wireframe-studio-body">
        {isLoading && (
          <div className="wireframe-editor-loading">
            <div className="wireframe-spinner" />
            <span>Loading Wireframe Studioâ€¦</span>
          </div>
        )}

        {/* â”€â”€ Left Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <aside className="wireframe-stencil-sidebar">
          <div className="wireframe-sidebar-header">
            <div className="wireframe-sidebar-label">Components</div>
            <div className="wireframe-sidebar-search">
              <Search size={13} className="wireframe-search-icon" />
              <input
                type="text"
                placeholder="Search componentsâ€¦"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wireframe-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wireframe-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  âœ•
                </button>
              )}
            </div>
          </div>

          <div className="wireframe-category-chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`wireframe-category-chip ${activeCategory === cat.id ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="wireframe-stencil-grid">
            {filteredStencils.length === 0 ? (
              <div className="wireframe-empty-stencils">
                No components match<br />
                <strong>{searchQuery}</strong>
              </div>
            ) : (
              filteredStencils.map((stencil) => (
                <div
                  key={stencil.id}
                  className="wireframe-stencil-card"
                  onClick={() => handleInsertStencil(stencil)}
                  title={stencil.desc}
                >
                  <div className="wireframe-stencil-icon">{stencil.icon}</div>
                  <div className="wireframe-stencil-info">
                    <div className="wireframe-stencil-name">{stencil.label}</div>
                    <div className="wireframe-stencil-desc">{stencil.desc}</div>
                  </div>
                  <div className="wireframe-stencil-add">
                    <Plus size={11} />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* â”€â”€ Center Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <main className="wireframe-canvas-container">
          <div className="wireframe-gjs-host">
            <div
              ref={editorContainerRef}
              style={{ width: "100%", height: "100%" }}
              aria-label="Wireframe canvas"
            />
          </div>
          {/* Status bar */}
          <div className="wireframe-canvas-statusbar">
            <span className="wireframe-canvas-statusbar-dot" />
            <span>Canvas ready Â· {activeDevice}</span>
            <div className="wireframe-canvas-tip">
              <kbd>Click</kbd> stencil to insert &nbsp;Â·&nbsp; <kbd>Ctrl+S</kbd> to save
            </div>
          </div>
        </main>

        {/* â”€â”€ Right Inspector Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <aside className="wireframe-inspector-panel">
          <div className="wireframe-inspector-tabs">
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "styles" ? "active" : ""}`}
              onClick={() => setActiveRightTab("styles")}
            >
              <Palette size={13} />
              <span>Design</span>
            </button>
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "traits" ? "active" : ""}`}
              onClick={() => setActiveRightTab("traits")}
            >
              <Sliders size={13} />
              <span>Props</span>
            </button>
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "layers" ? "active" : ""}`}
              onClick={() => setActiveRightTab("layers")}
            >
              <Layers size={13} />
              <span>Layers</span>
            </button>
          </div>

          <div className="wireframe-inspector-content">
            <div
              className="wireframe-sm-container"
              style={{ display: activeRightTab === "styles" ? "block" : "none" }}
            />
            <div
              className="wireframe-traits-container"
              style={{ display: activeRightTab === "traits" ? "block" : "none" }}
            >
              {activeRightTab === "traits" && (
                <div className="wireframe-inspector-empty">
                  <div className="wireframe-inspector-empty-icon">ðŸŽ›ï¸</div>
                  Select an element to edit its properties
                </div>
              )}
            </div>
            <div
              className="wireframe-layers-container"
              style={{ display: activeRightTab === "layers" ? "block" : "none" }}
            />
          </div>
        </aside>
      </div>
    </OverlayDialog>
  );
}

export default WireframeEditor;
