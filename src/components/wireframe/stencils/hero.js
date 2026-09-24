import { Sparkles, Zap, Layout, MessageSquare } from "lucide-react";

export const heroStencils = [
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
    </section>`
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
    </div>`
  },
  {
    id: "wf-hero-split-form",
    label: "Hero with Lead Capture Form",
    category: "hero",
    desc: "Headline, value proposition and quick signup box",
    icon: Sparkles,
    content: `<section style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:28px;align-items:center;padding:40px 28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;box-sizing:border-box;">
      <div>
        <span style="background:#dbeafe;color:#1e40af;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">Enterprise Ready</span>
        <h1 style="font-size:28px;font-weight:900;color:#0f172a;line-height:1.2;margin:10px 0 12px;">Build wireframes at the speed of thought</h1>
        <p style="font-size:12px;color:#64748b;line-height:1.6;margin:0 0 16px;">Collaborative UI stencils designed directly for engineers and product teams.</p>
        <div style="display:flex;gap:14px;font-size:11px;color:#475569;font-weight:600;">
          <span>✓ Local-first</span>
          <span>✓ Zero latency</span>
          <span>✓ PNG export</span>
        </div>
      </div>
      <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:24px;box-shadow:0 6px 20px rgba(0,0,0,0.05);">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px;">Request Live Demo</h3>
        <p style="font-size:11px;color:#64748b;margin:0 0 14px;">Instant access to the documentation suite.</p>
        <input type="text" placeholder="Full name" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-bottom:8px;box-sizing:border-box;" />
        <input type="email" placeholder="Work email" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-bottom:12px;box-sizing:border-box;" />
        <button style="width:100%;padding:9px;background:#2563eb;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Get Access</button>
      </div>
    </section>`
  },
  {
    id: "wf-video-hero",
    label: "Media Video Player Showcase",
    category: "hero",
    desc: "16:9 video player card with play button overlay",
    icon: Layout,
    content: `<div style="max-width:680px;margin:20px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);box-sizing:border-box;">
      <div style="position:relative;background:#0f172a;height:280px;display:flex;align-items:center;justify-content:center;color:#ffffff;">
        <div style="width:48px;height:48px;background:#2563eb;border-radius:999px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(37,99,235,0.4);cursor:pointer;">
          <span style="font-size:18px;margin-left:3px;">▶</span>
        </div>
        <span style="position:absolute;bottom:10px;right:12px;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">03:45</span>
      </div>
      <div style="padding:16px 20px;">
        <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px;">Product Walkthrough: Architecture & Flows</h3>
        <p style="font-size:11px;color:#64748b;margin:0;">Learn how to embed interactive wireframes inside your markdown files.</p>
      </div>
    </div>`
  },
  {
    id: "wf-testimonials",
    label: "Customer Quotes Showcase",
    category: "hero",
    desc: "Two-card social proof and customer ratings",
    icon: MessageSquare,
    content: `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;margin:18px 0;box-sizing:border-box;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="color:#f59e0b;font-size:13px;margin-bottom:8px;">★★★★★</div>
        <p style="font-size:12px;color:#334155;line-height:1.5;margin:0 0 14px;font-style:italic;">"The ability to design wireframes directly in notes revolutionized our product specification process."</p>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:30px;height:30px;background:#2563eb;color:#fff;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">AM</div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#0f172a;">Alex Morgan</div>
            <div style="font-size:10px;color:#64748b;">Staff Product Manager</div>
          </div>
        </div>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,0.02);">
        <div style="color:#f59e0b;font-size:13px;margin-bottom:8px;">★★★★★</div>
        <p style="font-size:12px;color:#334155;line-height:1.5;margin:0 0 14px;font-style:italic;">"Super clean, sleek and lightning fast. No heavy browser tabs or cloud logins required to sketch."</p>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:30px;height:30px;background:#10b981;color:#fff;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">SL</div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#0f172a;">Sarah Lin</div>
            <div style="font-size:10px;color:#64748b;">Principal Architect</div>
          </div>
        </div>
      </div>
    </div>`
  }
];
