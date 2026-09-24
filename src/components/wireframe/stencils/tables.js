import { Layers, Columns, FileText } from "lucide-react";

export const tableStencils = [
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
    </div>`
  },
  {
    id: "wf-kanban-board",
    label: "3-Column Kanban Board",
    category: "tables",
    desc: "To Do, In Progress, and Done task board",
    icon: Columns,
    content: `<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;margin:16px 0;box-sizing:border-box;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#0f172a;">To Do</span>
          <span style="background:#e2e8f0;color:#475569;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;">2</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <span style="background:#fee2e2;color:#991b1b;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;">Urgent</span>
          <div style="font-size:11px;font-weight:600;color:#0f172a;margin-top:4px;">Auth token expiry bug</div>
        </div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#0f172a;">In Progress</span>
          <span style="background:#e2e8f0;color:#475569;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;">1</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <span style="background:#eff6ff;color:#1e40af;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;">Feature</span>
          <div style="font-size:11px;font-weight:600;color:#0f172a;margin-top:4px;">Wireframe Stencil Library</div>
        </div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#0f172a;">Done</span>
          <span style="background:#dcfce7;color:#15803d;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;">3</span>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:10px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
          <span style="background:#f0fdf4;color:#166534;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;">Core</span>
          <div style="font-size:11px;font-weight:600;color:#0f172a;margin-top:4px;">Dropdown category filter</div>
        </div>
      </div>
    </div>`
  },
  {
    id: "wf-invoice-table",
    label: "Invoice Summary Table",
    category: "tables",
    desc: "Line item billing receipt with totals breakdown",
    icon: FileText,
    content: `<div style="max-width:520px;margin:16px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;">Invoice #INV-2048</div>
          <div style="font-size:10px;color:#64748b;">Issued on Jun 15, 2026</div>
        </div>
        <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">Paid</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;text-align:left;color:#64748b;font-size:10px;">
            <th style="padding:6px 0;">Item</th>
            <th style="padding:6px 0;text-align:center;">Qty</th>
            <th style="padding:6px 0;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;font-weight:600;color:#0f172a;">Notely Team Seat</td>
            <td style="padding:8px 0;text-align:center;color:#64748b;">5</td>
            <td style="padding:8px 0;text-align:right;color:#0f172a;">$95.00</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;font-weight:600;color:#0f172a;">Storage Tier</td>
            <td style="padding:8px 0;text-align:center;color:#64748b;">1</td>
            <td style="padding:8px 0;text-align:right;color:#0f172a;">$10.00</td>
          </tr>
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;">
        <div style="width:180px;display:flex;flex-direction:column;gap:4px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;color:#64748b;"><span>Subtotal:</span><span>$105.00</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;color:#0f172a;border-top:1px solid #e2e8f0;padding-top:4px;"><span>Total:</span><span>$105.00</span></div>
        </div>
      </div>
    </div>`
  }
];
