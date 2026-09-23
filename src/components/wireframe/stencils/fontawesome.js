import { Sparkles, Star, Award, ShieldCheck, Tag, Compass, Bookmark } from "lucide-react";

export const fontawesomeStencils = [
  {
    id: "wf-fa-icon-cloud",
    label: "FontAwesome Popular Icons Pack",
    category: "icons",
    desc: "Grid of standard FontAwesome icons ready to duplicate & customize",
    icon: Sparkles,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:20px;max-width:540px;margin:16px 0;box-sizing:border-box;">
      <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <i class="fa-solid fa-icons" style="color:#2563eb;"></i> FontAwesome Icon Palette
      </div>
      <div style="display:grid;grid-template-columns:repeat(6, 1fr);gap:10px;text-align:center;">
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#334155;background:#f8fafc;">
          <i class="fa-solid fa-house"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">house</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#334155;background:#f8fafc;">
          <i class="fa-solid fa-user"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">user</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#334155;background:#f8fafc;">
          <i class="fa-solid fa-gear"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">gear</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#334155;background:#f8fafc;">
          <i class="fa-solid fa-bell"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">bell</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#334155;background:#f8fafc;">
          <i class="fa-solid fa-envelope"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">envelope</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#334155;background:#f8fafc;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">search</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#2563eb;background:#f8fafc;">
          <i class="fa-solid fa-bolt"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">bolt</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#16a34a;background:#f8fafc;">
          <i class="fa-solid fa-circle-check"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">check</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#d97706;background:#f8fafc;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">warn</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#dc2626;background:#f8fafc;">
          <i class="fa-solid fa-heart"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">heart</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#8b5cf6;background:#f8fafc;">
          <i class="fa-solid fa-cloud"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">cloud</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 4px;font-size:18px;color:#0f172a;background:#f8fafc;">
          <i class="fa-solid fa-lock"></i>
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;">lock</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-fa-icon-buttons",
    label: "FontAwesome Icon Buttons Bar",
    category: "icons",
    desc: "Row of action buttons with leading FontAwesome icons",
    icon: Tag,
    content: `<div style="display:flex;align-items:center;gap:10px;margin:16px 0;box-sizing:border-box;flex-wrap:wrap;">
      <button style="padding:8px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-download"></i> Export Data
      </button>
      <button style="padding:8px 14px;background:#16a34a;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-circle-plus"></i> New Note
      </button>
      <button style="padding:8px 14px;background:#ffffff;border:1px solid #cbd5e1;color:#334155;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-rotate-right"></i> Refresh
      </button>
      <button style="padding:8px 14px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-trash-can"></i> Delete
      </button>
    </div>`
  },
  {
    id: "wf-fa-feature-cards",
    label: "FontAwesome 3-Column Features",
    category: "icons",
    desc: "Feature cards with FontAwesome icon headers & descriptions",
    icon: Award,
    content: `<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin:20px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-sizing:border-box;">
        <div style="width:40px;height:40px;border-radius:8px;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px;">Enterprise Security</h4>
        <p style="font-size:11px;color:#64748b;line-height:1.5;margin:0;">Encrypted local files, zero cloud exposure, and air-gapped support.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-sizing:border-box;">
        <div style="width:40px;height:40px;border-radius:8px;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">
          <i class="fa-solid fa-bolt"></i>
        </div>
        <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px;">Instant Real-Time</h4>
        <p style="font-size:11px;color:#64748b;line-height:1.5;margin:0;">Millisecond vector rendering and direct drag-and-drop mechanics.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-sizing:border-box;">
        <div style="width:40px;height:40px;border-radius:8px;background:#fdf4ff;color:#c026d3;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">
          <i class="fa-solid fa-palette"></i>
        </div>
        <h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px;">Figma Tokens</h4>
        <p style="font-size:11px;color:#64748b;line-height:1.5;margin:0;">Precision typography, spacing variables, and border-radius compliance.</p>
      </div>
    </div>`
  },
  {
    id: "wf-fa-alert-badges",
    label: "FontAwesome Status & Alert Badges",
    category: "icons",
    desc: "Success, Warning, Danger, and Info badges with FontAwesome icons",
    icon: ShieldCheck,
    content: `<div style="display:flex;flex-direction:column;gap:10px;max-width:480px;margin:16px 0;box-sizing:border-box;">
      <div style="background:#dcfce7;border:1px solid #86efac;color:#166534;border-radius:6px;padding:10px 14px;font-size:12px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-circle-check"></i>
        <span><strong>Success:</strong> System is operating normally within parameters.</span>
      </div>
      <div style="background:#fef3c7;border:1px solid #fde047;color:#854d0e;border-radius:6px;padding:10px 14px;font-size:12px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span><strong>Warning:</strong> High telemetry memory consumption detected.</span>
      </div>
      <div style="background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:6px;padding:10px 14px;font-size:12px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-circle-xmark"></i>
        <span><strong>Critical:</strong> Controller lost heartbeat connection.</span>
      </div>
      <div style="background:#e0f2fe;border:1px solid #7dd3fc;color:#075985;border-radius:6px;padding:10px 14px;font-size:12px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-circle-info"></i>
        <span><strong>Info:</strong> Firmware version 4.2.1 is available for download.</span>
      </div>
    </div>`
  },
  {
    id: "wf-fa-social-bar",
    label: "FontAwesome Brands & Social Bar",
    category: "icons",
    desc: "Brand icons for GitHub, X, LinkedIn, Discord, and Slack",
    icon: Compass,
    content: `<div style="display:flex;align-items:center;gap:12px;padding:12px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;max-width:320px;margin:16px 0;box-sizing:border-box;">
      <span style="font-size:11px;font-weight:700;color:#64748b;">Connect:</span>
      <a href="#" style="color:#0f172a;font-size:18px;text-decoration:none;"><i class="fa-brands fa-github"></i></a>
      <a href="#" style="color:#0f172a;font-size:18px;text-decoration:none;"><i class="fa-brands fa-x-twitter"></i></a>
      <a href="#" style="color:#0a66c2;font-size:18px;text-decoration:none;"><i class="fa-brands fa-linkedin"></i></a>
      <a href="#" style="color:#5865f2;font-size:18px;text-decoration:none;"><i class="fa-brands fa-discord"></i></a>
      <a href="#" style="color:#4a154b;font-size:18px;text-decoration:none;"><i class="fa-brands fa-slack"></i></a>
    </div>`
  },
  {
    id: "wf-fa-rating-card",
    label: "FontAwesome 5-Star Testimonial",
    category: "icons",
    desc: "Review testimonial with gold FontAwesome star rating",
    icon: Star,
    content: `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;max-width:400px;box-shadow:0 2px 6px rgba(0,0,0,0.03);margin:16px 0;box-sizing:border-box;">
      <div style="display:flex;gap:4px;color:#eab308;font-size:14px;margin-bottom:10px;">
        <i class="fa-solid fa-star"></i>
        <i class="fa-solid fa-star"></i>
        <i class="fa-solid fa-star"></i>
        <i class="fa-solid fa-star"></i>
        <i class="fa-solid fa-star"></i>
      </div>
      <p style="font-size:12px;color:#334155;line-height:1.6;font-style:italic;margin:0 0 14px;">"The wireframing studio with ThingWorx & FontAwesome stencils cuts our industrial UI prototyping from days to minutes."</p>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:999px;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">EM</div>
        <div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">Elena Morales</div>
          <div style="font-size:10px;color:#94a3b8;">Principal IoT Architect</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-fa-nav-pills",
    label: "FontAwesome Icon Navigation Tabs",
    category: "icons",
    desc: "Segmented tab bar with leading FontAwesome icons",
    icon: Bookmark,
    content: `<div style="display:inline-flex;background:#f1f5f9;padding:4px;border-radius:8px;gap:4px;margin:16px 0;box-sizing:border-box;">
      <button style="padding:6px 14px;border:none;background:#ffffff;color:#2563eb;font-weight:700;border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);cursor:pointer;">
        <i class="fa-solid fa-house"></i> Overview
      </button>
      <button style="padding:6px 14px;border:none;background:transparent;color:#64748b;font-weight:500;border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-chart-line"></i> Analytics
      </button>
      <button style="padding:6px 14px;border:none;background:transparent;color:#64748b;font-weight:500;border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-folder"></i> Assets
      </button>
      <button style="padding:6px 14px;border:none;background:transparent;color:#64748b;font-weight:500;border-radius:6px;font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <i class="fa-solid fa-gear"></i> Settings
      </button>
    </div>`
  }
];
