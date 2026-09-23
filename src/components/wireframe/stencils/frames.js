import { Monitor, Smartphone, Columns, Tablet, Sliders } from "lucide-react";

export const frameStencils = [
  {
    id: "wf-desktop-canvas",
    label: "Desktop Canvas (1200px)",
    category: "frames",
    desc: "Clean desktop artboard frame with header boundary",
    icon: Monitor,
    content: `<div style="max-width:1160px;margin:24px auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,0.06);min-height:640px;box-sizing:border-box;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:24px;border-bottom:1px dashed #e2e8f0;padding-bottom:10px;">Desktop Artboard Boundary (1200px)</div>
    </div>`
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
    </div>`
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
    </div>`
  },
  {
    id: "wf-tablet-frame",
    label: "Tablet Viewport Frame",
    category: "frames",
    desc: "768px tablet layout with camera indicator",
    icon: Tablet,
    content: `<div style="width:768px;min-height:560px;background:#ffffff;border:3px solid #1e293b;border-radius:12px;padding:24px 20px;margin:24px auto;box-shadow:0 12px 32px rgba(0,0,0,0.1);position:relative;box-sizing:border-box;">
      <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);width:8px;height:8px;background:#334155;border-radius:999px;"></div>
      <div style="font-size:11px;font-weight:700;color:#94a3b8;text-align:center;margin-bottom:18px;letter-spacing:0.05em;text-transform:uppercase;">Tablet Viewport (768px)</div>
    </div>`
  },
  {
    id: "wf-split-screen",
    label: "50/50 Split Screen Onboarding",
    category: "frames",
    desc: "Two-column hero brand showcase and signup form",
    icon: Columns,
    content: `<div style="display:flex;width:100%;min-height:400px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#ffffff;margin:16px 0;box-sizing:border-box;">
      <div style="flex:1;background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);color:#ffffff;padding:40px 32px;display:flex;flex-direction:column;justify-content:center;">
        <span style="font-size:11px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Notely Platform</span>
        <h2 style="font-size:24px;font-weight:800;line-height:1.2;margin:0 0 12px;">Next generation technical note-taking</h2>
        <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">Write markdown, sketch diagrams, design responsive wireframes, and collaborate offline.</p>
      </div>
      <div style="flex:1;padding:40px 32px;background:#ffffff;display:flex;flex-direction:column;justify-content:center;">
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 6px;">Create your account</h3>
        <p style="font-size:11px;color:#64748b;margin:0 0 18px;">Start building notes and wireframes locally.</p>
        <input type="text" placeholder="Full name" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-bottom:10px;box-sizing:border-box;" />
        <input type="email" placeholder="Work email" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-bottom:14px;box-sizing:border-box;" />
        <button style="padding:9px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Continue</button>
      </div>
    </div>`
  },
  {
    id: "wf-two-col-settings",
    label: "2-Column Settings View",
    category: "frames",
    desc: "Sidebar category navigation + form content pane",
    icon: Sliders,
    content: `<div style="display:flex;width:100%;min-height:320px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;overflow:hidden;margin:16px 0;box-sizing:border-box;">
      <div style="width:180px;background:#f8fafc;border-right:1px solid #e2e8f0;padding:16px 12px;flex-shrink:0;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:10px;">Settings</div>
        <div style="background:#e0e7ff;color:#3730a3;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;margin-bottom:4px;">General</div>
        <div style="color:#64748b;font-size:12px;font-weight:500;padding:6px 10px;border-radius:6px;margin-bottom:4px;">Team</div>
        <div style="color:#64748b;font-size:12px;font-weight:500;padding:6px 10px;border-radius:6px;">Security</div>
      </div>
      <div style="flex:1;padding:20px 24px;">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px;">Profile Details</h3>
        <p style="font-size:11px;color:#64748b;margin:0 0 16px;">Manage your public workspace presence.</p>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Display Name</label>
          <input type="text" value="Jane Doe" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;" />
        </div>
        <button style="padding:7px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Save</button>
      </div>
    </div>`
  }
];
