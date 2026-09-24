import { Square, User, Shield, MousePointer, Box, Folder } from "lucide-react";

export const uiStencils = [
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
    </div>`
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
    </div>`
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
    </div>`
  },
  {
    id: "wf-tags-chips",
    label: "Tags & Status Badges",
    category: "components",
    desc: "Pills for tags, status indicators and metadata",
    icon: Shield,
    content: `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 0;margin:10px 0;">
      <span style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">Design System</span>
      <span style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">Verified</span>
      <span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">In Review</span>
      <span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;">Urgent</span>
    </div>`
  },
  {
    id: "wf-context-menu",
    label: "Dropdown Context Menu",
    category: "components",
    desc: "Floating contextual action list",
    icon: MousePointer,
    content: `<div style="display:inline-block;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:5px;width:160px;box-shadow:0 8px 20px rgba(0,0,0,0.08);margin:10px 0;box-sizing:border-box;">
      <div style="padding:5px 8px;font-size:11px;font-weight:500;color:#0f172a;border-radius:4px;cursor:pointer;background:#f8fafc;">Duplicate</div>
      <div style="padding:5px 8px;font-size:11px;font-weight:500;color:#0f172a;border-radius:4px;cursor:pointer;">Rename</div>
      <div style="padding:5px 8px;font-size:11px;font-weight:500;color:#0f172a;border-radius:4px;cursor:pointer;">Export PNG</div>
      <div style="height:1px;background:#e2e8f0;margin:3px 0;"></div>
      <div style="padding:5px 8px;font-size:11px;font-weight:600;color:#ef4444;border-radius:4px;cursor:pointer;">Delete</div>
    </div>`
  },
  {
    id: "wf-pagination",
    label: "Pagination Control Bar",
    category: "components",
    desc: "Page navigation with active state",
    icon: Box,
    content: `<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin:14px 0;">
      <button style="padding:5px 10px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;">Prev</button>
      <button style="padding:5px 8px;border:none;background:#2563eb;color:#ffffff;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">1</button>
      <button style="padding:5px 8px;border:1px solid #e2e8f0;background:#ffffff;color:#334155;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">2</button>
      <button style="padding:5px 8px;border:1px solid #e2e8f0;background:#ffffff;color:#334155;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">3</button>
      <button style="padding:5px 10px;border:1px solid #cbd5e1;background:#ffffff;border-radius:4px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;">Next</button>
    </div>`
  },
  {
    id: "wf-dropzone",
    label: "File Upload Dropzone",
    category: "components",
    desc: "Dashed border file upload placeholder",
    icon: Folder,
    content: `<div style="border:2px dashed #cbd5e1;border-radius:8px;padding:28px 16px;text-align:center;background:#f8fafc;margin:14px 0;box-sizing:border-box;">
      <div style="font-size:24px;margin-bottom:6px;">☁️</div>
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:2px;">Drag and drop files here</div>
      <p style="font-size:10px;color:#64748b;margin:0 0 10px;">PNG, JPG, SVG up to 25MB</p>
      <button style="padding:5px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;font-weight:600;color:#334155;cursor:pointer;">Browse</button>
    </div>`
  }
];
