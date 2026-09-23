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
  ZoomIn,
  ZoomOut,
  BarChart3,
  FormInput,
  Shield,
  Zap,
  CreditCard,
  User,
  AlignLeft,
  Columns,
  MessageSquare,
} from "lucide-react";
import AppButton from "./AppButton";
import AppSelect from "./AppSelect";
import OverlayDialog from "./OverlayDialog";
import useConfirm from "../hooks/useConfirm";
import { writeWireframeSource, writeWireframeImage } from "../services/wireframeService";
import { runExport } from "../services/electronService";
import "grapesjs/dist/css/grapes.min.css";
import "../styles/ExcalidrawEditor.css";
import "../styles/WireframeEditor.css";

// --- Stencil Categories ---

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "frames", label: "Frames" },
  { id: "headers", label: "Nav" },
  { id: "hero", label: "Hero" },
  { id: "content", label: "Content" },
  { id: "metrics", label: "Stats" },
  { id: "components", label: "UI" },
  { id: "forms", label: "Forms" },
  { id: "tables", label: "Tables" },
  { id: "feedback", label: "Modals" },
];

// --- Curated Modern Lo-Fi / Mid-Fi Stencil Library ---

const WIREFRAME_STENCILS = [
  // --- Artboards & Frames ---
  {
    id: "wf-desktop-canvas",
    label: "Desktop Canvas (1200px)",
    category: "frames",
    desc: "Clean desktop artboard frame with header boundary",
    icon: Monitor,
    content: `<div style="max-width:1160px;margin:24px auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,0.06);min-height:640px;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:24px;border-bottom:1px dashed #e2e8f0;padding-bottom:10px;">Desktop Artboard Boundary (1200px)</div>
    </div>`,
  },
  {
    id: "wf-mobile-device",
    label: "Mobile iPhone Frame",
    category: "frames",
    desc: "375x720px mobile viewport with speaker notch",
    icon: Smartphone,
    content: `<div style="width:375px;min-height:720px;background:#ffffff;border:3px solid #1e293b;border-radius:8px;padding:24px 18px;margin:24px auto;box-shadow:0 12px 32px rgba(0,0,0,0.12);position:relative;box-sizing:border-box;">
      <div style="width:130px;height:20px;background:#0f172a;border-radius:0 0 8px 8px;margin:-24px auto 20px;display:flex;align-items:center;justify-content:center;">
        <span style="width:36px;height:4px;background:#334155;border-radius:999px;"></span>
      </div>
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-align:center;margin-bottom:16px;letter-spacing:0.05em;text-transform:uppercase;">Mobile Viewport (375px)</div>
    </div>`,
  },
  {
    id: "wf-app-shell",
    label: "SaaS Dashboard Shell",
    category: "frames",
    desc: "Sidebar navigation + topbar + main canvas container",
    icon: Columns,
    content: `<div style="display:flex;width:100%;min-height:540px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;box-sizing:border-box;">
      <div style="width:220px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:20px 16px;display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;color:#0f172a;margin-bottom:20px;">
          <span style="width:18px;height:18px;background:#2563eb;border-radius:4px;display:inline-block;"></span> Notely App
        </div>
        <div style="background:#e0e7ff;color:#3730a3;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;">Dashboard</div>
        <div style="color:#64748b;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;">Projects</div>
        <div style="color:#64748b;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;">Team</div>
        <div style="color:#64748b;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:500;margin-top:auto;">Settings</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;background:#ffffff;">
        <div style="height:54px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
          <span style="font-size:14px;font-weight:700;color:#0f172a;">Overview</span>
          <div style="width:30px;height:30px;background:#f1f5f9;border-radius:999px;border:1px solid #e2e8f0;"></div>
        </div>
        <div style="padding:24px;flex:1;background:#fafafa;">
          <div style="border:2px dashed #cbd5e1;border-radius:8px;padding:36px;text-align:center;color:#94a3b8;font-size:13px;">Drop dashboard widgets and cards here</div>
        </div>
      </div>
    </div>`,
  },

  // --- Headers & Navigation ---
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
    </header>`,
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
    </div>`,
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
    </div>`,
  },

  // --- Hero & Banner ---
  {
    id: "wf-hero-centered",
    label: "Hero Centered Section",
    category: "hero",
    desc: "Headline, badge, CTA buttons & screen mockup",
    icon: Sparkles,
    content: `<section style="text-align:center;padding:52px 24px;background:linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;box-sizing:border-box;">
      <div style="display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:16px;">
        <span>Release</span> v2.0 Live Now
      </div>
      <h1 style="font-size:34px;font-weight:900;color:#0f172a;margin:0 0 12px;letter-spacing:-0.03em;line-height:1.2;">Design systems that scale with ease</h1>
      <p style="font-size:14px;color:#64748b;max-width:540px;margin:0 auto 24px;line-height:1.6;">Create beautiful wireframes, mockups, and interface flows directly inside your documentation.</p>
      <div style="display:flex;justify-content:center;gap:12px;margin-bottom:36px;">
        <button style="padding:10px 24px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">Start for Free</button>
        <button style="padding:10px 20px;background:#ffffff;color:#334155;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Live Preview</button>
      </div>
      <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;height:220px;max-width:760px;margin:0 auto;box-shadow:0 12px 28px rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;font-weight:600;">
        [ App Preview Screen Mockup ]
      </div>
    </section>`,
  },
  {
    id: "wf-cta-banner",
    label: "Call to Action Banner",
    category: "hero",
    desc: "Dark accent conversion box with buttons",
    icon: Zap,
    content: `<div style="background:#0f172a;border-radius:8px;padding:36px 32px;display:flex;align-items:center;justify-content:space-between;color:#ffffff;margin:20px 0;box-sizing:border-box;">
      <div>
        <h2 style="font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-0.02em;">Ready to upgrade your workflow?</h2>
        <p style="font-size:13px;color:#94a3b8;margin:0;max-width:460px;">Collaborate in real time with high-velocity interface components.</p>
      </div>
      <div style="display:flex;gap:10px;">
        <button style="padding:10px 20px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">Get Started</button>
      </div>
    </div>`,
  },

  // --- Content & Grids ---
  {
    id: "wf-feature-grid-3",
    label: "3-Column Feature Cards",
    category: "content",
    desc: "Feature cards with icons, titles & descriptions",
    icon: Grid3X3,
    content: `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin:20px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="width:36px;height:36px;background:#eff6ff;color:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:14px;">⚡</div>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Lightning Fast</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0;">Instant drag-and-drop elements designed for rapid wireframing.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="width:36px;height:36px;background:#fdf2f8;color:#db2777;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:14px;">🎨</div>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Figma Precision</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0;">Pixel-calibrated spacing, modern typography, and clean tokens.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="width:36px;height:36px;background:#f0fdf4;color:#16a34a;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:14px;">🔒</div>
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">Offline Native</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0;">100% saved locally alongside notes with instant export capabilities.</p>
      </div>
    </div>`,
  },
  {
    id: "wf-bento-grid",
    label: "Bento Grid Layout",
    category: "content",
    desc: "Asymmetric 4-tile modern showcase layout",
    icon: Layout,
    content: `<div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin:20px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;">Core Feature</span>
        <h3 style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0 10px;">Interactive Canvas Controls</h3>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0 0 16px;">Manipulate layout, typography, borders, and fills directly in the property inspector.</p>
        <div style="height:120px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">Feature Visual Placeholder</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;flex:1;">
          <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px;">Instant PNG Export</h4>
          <p style="font-size:11px;color:#64748b;margin:0;">Generate high-res graphics embedded in notes automatically.</p>
        </div>
        <div style="background:#0f172a;color:#ffffff;border-radius:8px;padding:20px;flex:1;">
          <h4 style="font-size:14px;font-weight:700;margin:0 0 6px;">Local-First Security</h4>
          <p style="font-size:11px;color:#94a3b8;margin:0;">No third-party cloud required. Everything lives on your disk.</p>
        </div>
      </div>
    </div>`,
  },
  {
    id: "wf-pricing-card-group",
    label: "Pricing Tier Cards",
    category: "content",
    desc: "Starter vs Professional pricing comparison",
    icon: CreditCard,
    content: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:640px;margin:24px auto;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:28px;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Starter</div>
        <div style="font-size:28px;font-weight:900;color:#0f172a;margin:8px 0 14px;">$0<span style="font-size:13px;color:#94a3b8;font-weight:400;">/mo</span></div>
        <ul style="padding-left:0;list-style:none;font-size:12px;color:#475569;display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
          <li>✓ Up to 10 wireframes</li>
          <li>✓ Standard export (PNG)</li>
          <li>✓ Core stencil library</li>
        </ul>
        <button style="width:100%;padding:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Get Started</button>
      </div>
      <div style="background:#ffffff;border:2px solid #2563eb;border-radius:8px;padding:28px;box-shadow:0 6px 18px rgba(37,99,235,0.08);position:relative;">
        <span style="position:absolute;top:-10px;right:20px;background:#2563eb;color:#ffffff;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase;">Popular</span>
        <div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;">Professional</div>
        <div style="font-size:28px;font-weight:900;color:#0f172a;margin:8px 0 14px;">$19<span style="font-size:13px;color:#94a3b8;font-weight:400;">/mo</span></div>
        <ul style="padding-left:0;list-style:none;font-size:12px;color:#475569;display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
          <li>✓ Unlimited wireframes</li>
          <li>✓ Vector & SVG export</li>
          <li>✓ Full stencil packs</li>
        </ul>
        <button style="width:100%;padding:8px;border:none;background:#2563eb;color:#ffffff;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Upgrade Now</button>
      </div>
    </div>`,
  },

  // --- Metrics & Stats ---
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
    </div>`,
  },

  // --- UI Components ---
  {
    id: "wf-button-suite",
    label: "Button Styles Suite",
    category: "components",
    desc: "Primary, secondary, outline, ghost and danger buttons",
    icon: Square,
    content: `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:16px 0;margin:12px 0;">
      <button style="padding:8px 16px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Primary Action</button>
      <button style="padding:8px 16px;background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Secondary</button>
      <button style="padding:8px 16px;background:transparent;color:#334155;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Outline</button>
      <button style="padding:8px 16px;background:transparent;color:#64748b;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Ghost</button>
      <button style="padding:8px 16px;background:#ef4444;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Destructive</button>
    </div>`,
  },
  {
    id: "wf-avatar-stack",
    label: "Avatar Stack & Badge",
    category: "components",
    desc: "Collaborator face avatars with count chip",
    icon: User,
    content: `<div style="display:flex;align-items:center;gap:8px;margin:8px 0;">
      <div style="display:flex;margin-left:8px;">
        <span style="width:28px;height:28px;border-radius:999px;background:#2563eb;border:2px solid #ffffff;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-left:-8px;">JD</span>
        <span style="width:28px;height:28px;border-radius:999px;background:#10b981;border:2px solid #ffffff;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-left:-8px;">AL</span>
        <span style="width:28px;height:28px;border-radius:999px;background:#f59e0b;border:2px solid #ffffff;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-left:-8px;">RK</span>
      </div>
      <span style="font-size:11px;font-weight:600;color:#64748b;">+8 contributors active</span>
    </div>`,
  },
  {
    id: "wf-alert-banner",
    label: "Alert Notification Banner",
    category: "components",
    desc: "Info notification banner with icon and dismiss link",
    icon: Shield,
    content: `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;margin:12px 0;font-size:12px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-weight:700;">Notice:</span> Your workspace was upgraded to the latest version.
      </div>
      <span style="font-weight:600;cursor:pointer;text-decoration:underline;">View Changelog</span>
    </div>`,
  },

  // --- Forms & Inputs ---
  {
    id: "wf-auth-card",
    label: "Auth Sign-in Card",
    category: "forms",
    desc: "Centered sign-in card with email, password & button",
    icon: FormInput,
    content: `<div style="max-width:380px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,0.05);box-sizing:border-box;">
      <h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 6px;text-align:center;">Welcome back</h2>
      <p style="font-size:12px;color:#64748b;margin:0 0 24px;text-align:center;">Enter your credentials to access your notes</p>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:600;color:#334155;margin-bottom:6px;">Email address</label>
        <input type="text" placeholder="name@company.com" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;outline:none;" />
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:11px;font-weight:600;color:#334155;margin-bottom:6px;">Password</label>
        <input type="password" placeholder="••••••••" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;outline:none;" />
      </div>
      <button style="width:100%;padding:10px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">Sign in</button>
    </div>`,
  },
  {
    id: "wf-search-filter-bar",
    label: "Search & Filter Bar",
    category: "forms",
    desc: "Search bar with category dropdown and action button",
    icon: Search,
    content: `<div style="display:flex;align-items:center;gap:10px;padding:6px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;margin:12px 0;box-sizing:border-box;">
      <div style="flex:1;display:flex;align-items:center;gap:8px;padding-left:8px;">
        <span style="color:#94a3b8;font-size:13px;">🔍</span>
        <input type="text" placeholder="Search resources, documents and tags..." style="width:100%;border:none;outline:none;font-size:12px;color:#0f172a;" />
      </div>
      <select style="border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;font-size:11px;color:#475569;background:#f8fafc;outline:none;">
        <option>All Types</option>
        <option>Notes</option>
        <option>Diagrams</option>
      </select>
      <button style="padding:6px 14px;background:#0f172a;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Filter</button>
    </div>`,
  },

  // --- Data & Tables ---
  {
    id: "wf-data-table",
    label: "Modern Data Table",
    category: "tables",
    desc: "Structured data table with status pills and actions",
    icon: Layers,
    content: `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;margin:16px 0;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <th style="padding:10px 16px;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;">Name</th>
            <th style="padding:10px 16px;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;">Status</th>
            <th style="padding:10px 16px;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;">Role</th>
            <th style="padding:10px 16px;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-weight:600;color:#0f172a;">Bikash Panda</td>
            <td style="padding:12px 16px;"><span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">Active</span></td>
            <td style="padding:12px 16px;color:#64748b;">Admin</td>
            <td style="padding:12px 16px;text-align:right;color:#64748b;cursor:pointer;">•••</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px;font-weight:600;color:#0f172a;">Sarah Connor</td>
            <td style="padding:12px 16px;"><span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">Pending</span></td>
            <td style="padding:12px 16px;color:#64748b;">Editor</td>
            <td style="padding:12px 16px;text-align:right;color:#64748b;cursor:pointer;">•••</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;font-weight:600;color:#0f172a;">Alex Murphy</td>
            <td style="padding:12px 16px;"><span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">Inactive</span></td>
            <td style="padding:12px 16px;color:#64748b;">Viewer</td>
            <td style="padding:12px 16px;text-align:right;color:#64748b;cursor:pointer;">•••</td>
          </tr>
        </tbody>
      </table>
    </div>`,
  },

  // --- Modals & Feedback ---
  {
    id: "wf-modal-dialog",
    label: "Confirmation Modal Dialog",
    category: "feedback",
    desc: "Dialog card with title, body text and cancel/confirm buttons",
    icon: MousePointer,
    content: `<div style="max-width:440px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-shadow:0 12px 32px rgba(0,0,0,0.1);box-sizing:border-box;">
      <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0 0 8px;">Delete Project</h3>
      <p style="font-size:12px;color:#64748b;line-height:1.5;margin:0 0 20px;">Are you sure you want to delete this project? This action cannot be undone.</p>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button style="padding:8px 16px;background:#ffffff;border:1px solid #cbd5e1;color:#334155;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Cancel</button>
        <button style="padding:8px 16px;background:#ef4444;border:none;color:#ffffff;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Delete</button>
      </div>
    </div>`,
  },
  {
    id: "wf-empty-state-card",
    label: "Empty State Placeholder",
    category: "feedback",
    desc: "Icon, empty message and primary action button",
    icon: MessageSquare,
    content: `<div style="text-align:center;padding:48px 24px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:8px;margin:20px 0;box-sizing:border-box;">
      <div style="font-size:32px;margin-bottom:12px;">📁</div>
      <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 6px;">No documents yet</h3>
      <p style="font-size:12px;color:#64748b;max-width:320px;margin:0 auto 16px;">Create your first document or import notes from Markdown to get started.</p>
      <button style="padding:8px 18px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Create Document</button>
    </div>`,
  },
];

// --- Export to PNG helper ---

function exportWireframeToPng(editor) {
  return new Promise((resolve) => {
    if (!editor) {
      resolve(createFallbackPng(editor));
      return;
    }

    try {
      const width = 1200;
      const height = 800;

      const frameDoc = editor.Canvas?.getDocument?.();
      const frameBody = frameDoc?.body;
      let bodyXml = "";
      let cssText = editor.getCss?.() || "";

      if (frameDoc && frameBody) {
        // Collect canvas iframe styles
        const styleTags = frameDoc.querySelectorAll("style");
        styleTags.forEach((s) => {
          cssText += "\n" + (s.textContent || "");
        });

        // Clone and sanitize selection markers
        const clone = frameBody.cloneNode(true);
        clone.querySelectorAll(".gjs-selected, .gjs-hovered").forEach((el) => {
          el.classList.remove("gjs-selected", "gjs-hovered");
        });

        const serializer = new XMLSerializer();
        bodyXml = serializer.serializeToString(clone);
      } else {
        const rawHtml = editor.getHtml?.() || "";
        bodyXml = `<div xmlns="http://www.w3.org/1999/xhtml">${rawHtml}</div>`;
      }

      const svgDoc = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff;width:${width}px;height:${height}px;box-sizing:border-box;overflow:hidden;font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <style>
                *, *::before, *::after { box-sizing: border-box; }
                body { margin: 0; padding: 24px; background: #ffffff; color: #0f172a; }
                ${cssText}
              </style>
              ${bodyXml}
            </div>
          </foreignObject>
        </svg>
      `.trim();

      const img = new Image();
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoc)}`;

      const fallbackTimer = setTimeout(() => {
        resolve(createFallbackPng(editor));
      }, 2000);

      img.onload = () => {
        clearTimeout(fallbackTimer);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(createFallbackPng(editor));
        }
      };

      img.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve(createFallbackPng(editor));
      };

      img.src = dataUri;
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

  // Canvas background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 1200, 800);

  // Border frame
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 1160, 760);

  // Header mockup
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(20, 20, 1160, 60);
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(44, 40, 20, 20);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Wireframe Mockup", 74, 55);

  // Content area
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(60, 120, 1080, 600);
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(60, 120, 1080, 600);

  ctx.fillStyle = "#64748b";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";

  const html = editor?.getHtml?.() || "";
  const hasContent = html.replace(/<[^>]+>/g, "").trim().length > 10;
  ctx.fillText(hasContent ? "Wireframe UI Design" : "Wireframe Artboard", 600, 420);

  return canvas.toDataURL("image/png");
}

// --- WireframeEditor Component ---

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
  const [zoomLevel, setZoomLevel] = useState(100);

  const filteredStencils = useMemo(() => {
    return WIREFRAME_STENCILS.filter((item) => {
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
                name: "Layout & Flexbox",
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
          cssIcons: "",
          canvas: {
            styles: [],
            scripts: [],
            frameStyle: `
              *, *::before, *::after { box-sizing: border-box; }
              html {
                height: 100%;
                background: #f1f5f9;
              }
              body {
                margin: 0;
                padding: 40px 24px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background: #f8fafc;
                min-height: 100%;
                color: #0f172a;
              }
              .gjs-selected {
                outline: 2px solid var(--accent-solid, #2f5d62) !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-solid, #2f5d62) 20%, transparent) !important;
              }
              .gjs-hovered {
                outline: 1px dashed var(--accent-solid, #2f5d62) !important;
                outline-offset: 1px !important;
              }
            `,
          },
        });

        editorRef.current = editor;

        // Register components into BlockManager
        const bm = editor.BlockManager;
        WIREFRAME_STENCILS.forEach((stencil) => {
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

  // Zoom controls
  const handleZoom = (delta) => {
    const nextZoom = Math.min(Math.max(zoomLevel + delta, 40), 200);
    setZoomLevel(nextZoom);
    editorRef.current?.Canvas?.setZoom(nextZoom);
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
    editorRef.current?.Canvas?.setZoom(100);
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

  // Drag-and-drop handler for stencils
  const handleStencilDragStart = (e, stencil) => {
    try {
      e.dataTransfer.setData("text/html", stencil.content);
      e.dataTransfer.setData("text/plain", stencil.content);
      e.dataTransfer.effectAllowed = "copy";
    } catch {
      // fallback
    }
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
      {/* Dark Studio Top Toolbar */}
      <div className="wireframe-studio-header">
        {/* Brand */}
        <div className="wireframe-studio-title-group">
          <div className="wireframe-studio-logo">
            <Layout size={14} color="var(--text-on-accent, #ffffff)" />
          </div>
          <span className="wireframe-studio-title">Wireframe Studio</span>
        </div>

        <div className="wireframe-header-divider" />

        {/* Viewport switchers */}
        <div className="wireframe-viewport-controls">
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Desktop" ? "active" : ""}`}
            onClick={() => handleSetDevice("Desktop")}
            data-tooltip="Desktop viewport (Full)"
            aria-label="Desktop viewport"
          >
            <Monitor size={14} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Tablet" ? "active" : ""}`}
            onClick={() => handleSetDevice("Tablet")}
            data-tooltip="Tablet viewport (768px)"
            aria-label="Tablet viewport"
          >
            <Tablet size={14} />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            className={`wireframe-vp-btn ${activeDevice === "Mobile" ? "active" : ""}`}
            onClick={() => handleSetDevice("Mobile")}
            data-tooltip="Mobile viewport (375px)"
            aria-label="Mobile viewport"
          >
            <Smartphone size={14} />
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
            data-tooltip="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className="wireframe-tool-icon-btn"
            onClick={handleRedo}
            data-tooltip="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 size={14} />
          </button>
          <span className="wireframe-tool-sep" />
          <button
            type="button"
            className={`wireframe-tool-icon-btn ${gridVisible ? "active" : ""}`}
            onClick={handleToggleBorders}
            data-tooltip="Toggle Layout Bounds"
            aria-label="Toggle layout bounds"
          >
            {gridVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            className="wireframe-tool-icon-btn danger"
            onClick={handleClear}
            data-tooltip="Clear Canvas"
            aria-label="Clear canvas"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="wireframe-action-buttons">
          {hasUnsavedChanges && <span className="wf-unsaved-dot" title="Unsaved changes" />}
          <AppButton
            variant="small"
            onClick={handleDownload}
            disabled={isSaving || isExporting || isLoading}
            title="Export wireframe as PNG"
          >
            <Download size={14} aria-hidden="true" />
            <span>{isExporting ? "Exporting..." : "Export PNG"}</span>
          </AppButton>
          <AppButton
            ref={saveButtonRef}
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || isExporting || isLoading}
            title="Save wireframe (Ctrl+S)"
          >
            <Save size={14} aria-hidden="true" />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </AppButton>
          <AppButton
            variant="small"
            iconOnly
            onClick={handleClose}
            disabled={isSaving || isExporting}
            title="Close"
            aria-label="Close"
          >
            <X size={14} aria-hidden="true" />
          </AppButton>
        </div>
      </div>

      {/* Studio Body */}
      <div className="wireframe-studio-body">
        {isLoading && (
          <div className="wireframe-editor-loading">
            <div className="wireframe-spinner" />
            <span>Loading Wireframe Studio...</span>
          </div>
        )}

        {/* Left Sidebar: Stencil Library */}
        <aside className="wireframe-stencil-sidebar">
          <div className="wireframe-sidebar-header">
            <div className="wireframe-sidebar-label">Components Library</div>
            <div className="wireframe-sidebar-search">
              <Search size={14} className="wireframe-search-icon" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wireframe-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wireframe-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="wireframe-category-select-wrapper">
              <AppSelect
                id="wireframe-category-select"
                className="wireframe-category-select"
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                aria-label="Filter components by category"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </AppSelect>
            </div>
          </div>

          <div className="wireframe-stencil-grid">
            {filteredStencils.length === 0 ? (
              <div className="wireframe-empty-stencils">
                No components match<br />
                <strong>{searchQuery}</strong>
              </div>
            ) : (
              filteredStencils.map((stencil) => {
                const StencilIcon = stencil.icon || Layout;
                return (
                  <div
                    key={stencil.id}
                    className="wireframe-stencil-tile"
                    draggable
                    onDragStart={(e) => handleStencilDragStart(e, stencil)}
                    onClick={() => handleInsertStencil(stencil)}
                    title={`${stencil.label}\n${stencil.desc}\n• Click or drag to canvas`}
                  >
                    <div className="wireframe-stencil-tile-icon">
                      <StencilIcon size={16} />
                    </div>
                    <span className="wireframe-stencil-tile-name">{stencil.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="wireframe-canvas-container">
          <div className="wireframe-canvas-top-tag">
            <span className="wireframe-artboard-pill">
              {activeDevice === "Desktop" && "Desktop Screen · 1200px"}
              {activeDevice === "Tablet" && "Tablet Viewport · 768px"}
              {activeDevice === "Mobile" && "Mobile Device · 375px"}
            </span>
          </div>
          <div className="wireframe-gjs-host">
            <div
              ref={editorContainerRef}
              style={{ width: "100%", height: "100%" }}
              aria-label="Wireframe canvas"
            />
          </div>
          {/* Status bar with Zoom */}
          <div className="wireframe-canvas-statusbar">
            <span className="wireframe-canvas-statusbar-dot" />
            <span>Ready · {activeDevice}</span>

            {/* Zoom Controls */}
            <div className="wireframe-zoom-controls">
              <button
                type="button"
                className="wireframe-zoom-btn"
                onClick={() => handleZoom(-10)}
                data-tooltip="Zoom Out"
                aria-label="Zoom out"
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                className="wireframe-zoom-label"
                onClick={handleZoomReset}
                data-tooltip="Reset Zoom (100%)"
                aria-label="Reset zoom"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                className="wireframe-zoom-btn"
                onClick={() => handleZoom(10)}
                data-tooltip="Zoom In"
                aria-label="Zoom in"
              >
                <ZoomIn size={12} />
              </button>
            </div>

            <div className="wireframe-canvas-tip">
              <span>Drag or click stencil to add</span>
              <span className="wf-tip-dot">·</span>
              <kbd>Ctrl+S</kbd> to save
            </div>
          </div>
        </main>

        {/* Right Inspector Panel */}
        <aside className="wireframe-inspector-panel">
          <div className="wireframe-inspector-tabs">
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "styles" ? "active" : ""}`}
              onClick={() => setActiveRightTab("styles")}
            >
              <Palette size={14} />
              <span>Design</span>
            </button>
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "traits" ? "active" : ""}`}
              onClick={() => setActiveRightTab("traits")}
            >
              <Sliders size={14} />
              <span>Props</span>
            </button>
            <button
              type="button"
              className={`wireframe-inspector-tab ${activeRightTab === "layers" ? "active" : ""}`}
              onClick={() => setActiveRightTab("layers")}
            >
              <Layers size={14} />
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
                  <Sliders size={20} className="wireframe-empty-icon-svg" />
                  <span>Select an element to edit component attributes</span>
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
