import { Grid3X3, Layout, CreditCard, FileText, Clock, HelpCircle } from "lucide-react";

export const contentStencils = [
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
    </div>`
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
    </div>`
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
    </div>`
  },
  {
    id: "wf-blog-cards",
    label: "3-Column Article / Blog Cards",
    category: "content",
    desc: "Cards with cover image placeholder, tag & metadata",
    icon: FileText,
    content: `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;margin:18px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="height:90px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:600;">[ Cover Image ]</div>
        <div style="padding:14px;">
          <span style="background:#eff6ff;color:#2563eb;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;">Design Systems</span>
          <h4 style="font-size:13px;font-weight:700;color:#0f172a;margin:6px 0 4px;">Scaling lo-fi wireframes to production</h4>
          <div style="font-size:10px;color:#94a3b8;font-weight:600;">5 min read • Jun 12</div>
        </div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="height:90px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:600;">[ Cover Image ]</div>
        <div style="padding:14px;">
          <span style="background:#fef3c7;color:#b45309;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;">Engineering</span>
          <h4 style="font-size:13px;font-weight:700;color:#0f172a;margin:6px 0 4px;">Offline-first local file architecture</h4>
          <div style="font-size:10px;color:#94a3b8;font-weight:600;">8 min read • Jun 18</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-timeline",
    label: "Vertical Timeline & History",
    category: "content",
    desc: "Chronological milestone entries with node dots",
    icon: Clock,
    content: `<div style="max-width:440px;margin:16px 0;padding:16px 20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;box-sizing:border-box;">
      <h3 style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 14px;">Release History</h3>
      <div style="position:relative;padding-left:20px;border-left:2px solid #e2e8f0;display:flex;flex-direction:column;gap:16px;">
        <div style="position:relative;">
          <div style="position:absolute;left:-26px;top:0;width:10px;height:10px;border-radius:999px;background:#2563eb;border:2px solid #ffffff;"></div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">v2.1.0 - Wireframe Studio</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">Added GrapesJS canvas with 40+ stencils.</div>
        </div>
        <div style="position:relative;">
          <div style="position:absolute;left:-26px;top:0;width:10px;height:10px;border-radius:999px;background:#94a3b8;border:2px solid #ffffff;"></div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;">v2.0.4 - Performance</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">Improved media rendering speeds.</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-faq-accordion",
    label: "FAQ Accordion Rows",
    category: "content",
    desc: "Expandable question & answer cards",
    icon: HelpCircle,
    content: `<div style="max-width:580px;margin:16px auto;display:flex;flex-direction:column;gap:8px;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
          <span style="font-size:12px;font-weight:700;color:#0f172a;">Are wireframes stored locally on disk?</span>
          <span style="font-size:10px;color:#64748b;">▲</span>
        </div>
        <p style="font-size:11px;color:#64748b;line-height:1.5;margin:8px 0 0;">Yes, wireframes are stored as JSON and PNG previews directly inside your note folder.</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
          <span style="font-size:12px;font-weight:700;color:#0f172a;">Can I export wireframes as PNG images?</span>
          <span style="font-size:10px;color:#64748b;">▼</span>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-feature-matrix",
    label: "Feature Comparison Matrix",
    category: "content",
    desc: "Tiered feature checkmark table",
    icon: Grid3X3,
    content: `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;margin:16px 0;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;text-align:center;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#0f172a;width:40%;">Feature</th>
            <th style="padding:10px 14px;font-weight:700;color:#64748b;width:20%;">Free</th>
            <th style="padding:10px 14px;font-weight:700;color:#2563eb;width:20%;">Pro</th>
            <th style="padding:10px 14px;font-weight:700;color:#0f172a;width:20%;">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 14px;text-align:left;color:#334155;font-weight:500;">Local-first notes</td>
            <td style="padding:10px 14px;color:#10b981;">✓</td>
            <td style="padding:10px 14px;color:#10b981;">✓</td>
            <td style="padding:10px 14px;color:#10b981;">✓</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 14px;text-align:left;color:#334155;font-weight:500;">Interactive Wireframes</td>
            <td style="padding:10px 14px;color:#64748b;">5</td>
            <td style="padding:10px 14px;color:#10b981;">✓</td>
            <td style="padding:10px 14px;color:#10b981;">✓</td>
          </tr>
        </tbody>
      </table>
    </div>`
  }
];
