import { MousePointer, MessageSquare, Layout, Shield, Bell } from "lucide-react";

export const feedbackStencils = [
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
    </div>`
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
    </div>`
  },
  {
    id: "wf-slideover",
    label: "Slide-over Drawer / Sheet",
    category: "feedback",
    desc: "Right-hand sidebar inspection drawer",
    icon: Layout,
    content: `<div style="display:flex;width:100%;height:260px;border:1px solid #cbd5e1;border-radius:8px;background:#f1f5f9;position:relative;overflow:hidden;margin:14px 0;box-sizing:border-box;">
      <div style="flex:1;padding:20px;color:#64748b;font-size:12px;">Background Canvas View</div>
      <div style="width:240px;background:#ffffff;border-left:1px solid #e2e8f0;padding:16px;display:flex;flex-direction:column;box-shadow:-4px 0 16px rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:13px;font-weight:700;color:#0f172a;">Inspect Element</span>
          <span style="cursor:pointer;color:#94a3b8;font-size:12px;">✕</span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-bottom:10px;">Select properties to adjust attributes.</div>
        <button style="margin-top:auto;padding:7px;background:#0f172a;color:#ffffff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Apply</button>
      </div>
    </div>`
  },
  {
    id: "wf-gdpr-banner",
    label: "Cookie & Consent Bar",
    category: "feedback",
    desc: "Floating bottom privacy notification bar",
    icon: Shield,
    content: `<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 6px 20px rgba(0,0,0,0.06);margin:14px 0;box-sizing:border-box;">
      <div style="font-size:11px;color:#475569;line-height:1.5;">
        We use local storage cookies to remember your workspace state and active themes.
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button style="padding:5px 12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;font-weight:600;color:#334155;cursor:pointer;">Preferences</button>
        <button style="padding:5px 14px;background:#0f172a;border:none;border-radius:4px;font-size:10px;font-weight:600;color:#ffffff;cursor:pointer;">Accept</button>
      </div>
    </div>`
  },
  {
    id: "wf-toast-stack",
    label: "Toast Notifications Stack",
    category: "feedback",
    desc: "Success and alert notification popups",
    icon: Bell,
    content: `<div style="display:flex;flex-direction:column;gap:6px;max-width:280px;margin:14px 0;">
      <div style="display:flex;align-items:center;gap:8px;background:#ffffff;border:1px solid #bbf7d0;border-left:3px solid #10b981;border-radius:6px;padding:10px 12px;box-shadow:0 3px 10px rgba(0,0,0,0.05);">
        <span style="color:#10b981;font-size:14px;">✓</span>
        <div>
          <div style="font-size:11px;font-weight:700;color:#0f172a;">Note saved</div>
          <div style="font-size:10px;color:#64748b;">Diagram files updated on disk</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:#ffffff;border:1px solid #fecaca;border-left:3px solid #ef4444;border-radius:6px;padding:10px 12px;box-shadow:0 3px 10px rgba(0,0,0,0.05);">
        <span style="color:#ef4444;font-size:14px;">⚠</span>
        <div>
          <div style="font-size:11px;font-weight:700;color:#0f172a;">Export alert</div>
          <div style="font-size:10px;color:#64748b;">Canvas contains unsaved elements</div>
        </div>
      </div>
    </div>`
  }
];
