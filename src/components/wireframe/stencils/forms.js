import { FormInput, Search, Zap, CreditCard, Sliders } from "lucide-react";

export const formStencils = [
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
    </div>`
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
    </div>`
  },
  {
    id: "wf-wizard-stepper",
    label: "Multi-Step Wizard Stepper",
    category: "forms",
    desc: "Step 1-2-3 horizontal progress indicator",
    icon: Zap,
    content: `<div style="display:flex;align-items:center;justify-content:center;gap:10px;max-width:440px;margin:16px auto;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:20px;height:20px;border-radius:999px;background:#2563eb;color:#ffffff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">1</span>
        <span style="font-size:11px;font-weight:700;color:#0f172a;">Account</span>
      </div>
      <div style="width:28px;height:2px;background:#2563eb;"></div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:20px;height:20px;border-radius:999px;background:#e0e7ff;color:#2563eb;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">2</span>
        <span style="font-size:11px;font-weight:600;color:#2563eb;">Workspace</span>
      </div>
      <div style="width:28px;height:2px;background:#e2e8f0;"></div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:20px;height:20px;border-radius:999px;background:#f1f5f9;color:#94a3b8;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">3</span>
        <span style="font-size:11px;font-weight:500;color:#94a3b8;">Review</span>
      </div>
    </div>`
  },
  {
    id: "wf-contact-form",
    label: "Contact & Feedback Form",
    category: "forms",
    desc: "Support request form with input fields and textarea",
    icon: FormInput,
    content: `<div style="max-width:460px;margin:16px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.03);box-sizing:border-box;">
      <h3 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 4px;">Contact Support</h3>
      <p style="font-size:11px;color:#64748b;margin:0 0 16px;">We typically respond within an hour.</p>
      <div style="display:flex;gap:10px;margin-bottom:10px;">
        <div style="flex:1;">
          <label style="display:block;font-size:10px;font-weight:600;color:#334155;margin-bottom:4px;">First name</label>
          <input type="text" placeholder="John" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;" />
        </div>
        <div style="flex:1;">
          <label style="display:block;font-size:10px;font-weight:600;color:#334155;margin-bottom:4px;">Last name</label>
          <input type="text" placeholder="Doe" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;" />
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:10px;font-weight:600;color:#334155;margin-bottom:4px;">Message</label>
        <textarea rows="3" placeholder="Describe your inquiry..." style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
      <button style="width:100%;padding:9px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Send Message</button>
    </div>`
  },
  {
    id: "wf-credit-card",
    label: "Credit Card Payment Form",
    category: "forms",
    desc: "Card number, expiration and security code fields",
    icon: CreditCard,
    content: `<div style="max-width:360px;margin:16px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 4px 14px rgba(0,0,0,0.04);box-sizing:border-box;">
      <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 14px;">Payment Method</h3>
      <div style="margin-bottom:10px;">
        <label style="display:block;font-size:10px;font-weight:600;color:#475569;margin-bottom:4px;">Card Number</label>
        <input type="text" placeholder="4242 •••• •••• 4242" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;" />
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px;">
        <div style="flex:1;">
          <label style="display:block;font-size:10px;font-weight:600;color:#475569;margin-bottom:4px;">Expires</label>
          <input type="text" placeholder="MM/YY" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;" />
        </div>
        <div style="flex:1;">
          <label style="display:block;font-size:10px;font-weight:600;color:#475569;margin-bottom:4px;">CVC</label>
          <input type="text" placeholder="123" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;box-sizing:border-box;" />
        </div>
      </div>
      <button style="width:100%;padding:9px;background:#10b981;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Pay $49.00</button>
    </div>`
  },
  {
    id: "wf-settings-toggles",
    label: "Preference Toggles List",
    category: "forms",
    desc: "Switch toggle rows for feature settings",
    icon: Sliders,
    content: `<div style="max-width:440px;margin:14px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div>
          <div style="font-size:11px;font-weight:600;color:#0f172a;">Dark Theme</div>
          <div style="font-size:10px;color:#64748b;">Follow system appearance</div>
        </div>
        <div style="width:32px;height:18px;background:#2563eb;border-radius:999px;position:relative;cursor:pointer;">
          <div style="width:14px;height:14px;background:#ffffff;border-radius:999px;position:absolute;top:2px;right:2px;"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;">
        <div>
          <div style="font-size:11px;font-weight:600;color:#0f172a;">Auto-save Notes</div>
          <div style="font-size:10px;color:#64748b;">Save diagrams on change</div>
        </div>
        <div style="width:32px;height:18px;background:#cbd5e1;border-radius:999px;position:relative;cursor:pointer;">
          <div style="width:14px;height:14px;background:#ffffff;border-radius:999px;position:absolute;top:2px;left:2px;"></div>
        </div>
      </div>
    </div>`
  }
];
