import {
  Layout,
  Columns,
  Square,
  PanelLeft,
  PanelLeftClose,
  PanelTop,
  PanelBottom,
  Menu,
  ChevronRight,
  Bookmark,
  Layers,
  Sliders,
  CheckSquare,
  ToggleLeft,
  Calendar,
  AlignLeft,
  Type,
  Image,
  Star,
  Minus,
  MoveVertical,
  Table,
  List,
  Tag,
  Activity,
  AlertTriangle,
  Bell,
  MessageSquare,
  CheckCircle,
  Loader2,
  Inbox,
  ArrowLeft,
  Maximize2,
  Sparkles,
  Rows,
  SplitSquareVertical,
  Navigation,
  Search,
  ListFilter,
  CircleDot,
  MousePointerClick
} from "lucide-react";

export const CATEGORIES = [
  { id: "all", label: "All Components" },
  { id: "layout", label: "Layout" },
  { id: "navigation", label: "Navigation" },
  { id: "controls", label: "Controls" },
  { id: "data", label: "Data" },
  { id: "feedback", label: "Feedback" },
  { id: "content", label: "Content" }
];

export const COMPONENT_REGISTRY = [
  // ==========================================
  // LAYOUT
  // ==========================================
  {
    id: "wf-page",
    name: "Page",
    label: "Page",
    category: "layout",
    icon: Layout,
    desc: "Top-level full page container",
    defaults: { width: "100%", minHeight: "600px", padding: "24px" },
    content: `
      <div class="wf-page" data-wf-type="page" data-dev-note="" style="width: 100%; min-height: 600px; padding: 24px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
        <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px;">Page Layout Area</div>
      </div>
    `
  },
  {
    id: "wf-container",
    name: "Container",
    label: "Container",
    category: "layout",
    icon: Square,
    desc: "Flex container box with customizable padding",
    defaults: { width: "100%", padding: "16px", gap: "16px", direction: "column" },
    content: `
      <div class="wf-container" data-wf-type="container" data-dev-note="" style="width: 100%; min-height: 120px; padding: 16px; background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 4px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
        <span style="font-size: 11px; color: #64748b; font-style: italic;">Container</span>
      </div>
    `
  },
  {
    id: "wf-row",
    name: "Row",
    label: "Row",
    category: "layout",
    icon: Rows,
    desc: "Horizontal flex row for side-by-side items",
    defaults: { width: "100%", gap: "16px" },
    content: `
      <div class="wf-row" data-wf-type="row" data-dev-note="" style="width: 100%; min-height: 60px; display: flex; flex-direction: row; align-items: center; gap: 16px; padding: 8px; border: 1px dashed #cbd5e1; border-radius: 4px; box-sizing: border-box;">
        <div style="flex: 1; min-height: 44px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748b;">Row Item 1</div>
        <div style="flex: 1; min-height: 44px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748b;">Row Item 2</div>
      </div>
    `
  },
  {
    id: "wf-column",
    name: "Column",
    label: "Column",
    category: "layout",
    icon: Columns,
    desc: "Vertical flex column for stacked items",
    defaults: { flex: "1", gap: "12px" },
    content: `
      <div class="wf-column" data-wf-type="column" data-dev-note="" style="flex: 1; min-height: 100px; display: flex; flex-direction: column; gap: 12px; padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; box-sizing: border-box;">
        <span style="font-size: 11px; color: #64748b;">Column</span>
      </div>
    `
  },
  {
    id: "wf-stack",
    name: "Stack",
    label: "Stack",
    category: "layout",
    icon: Layers,
    desc: "Vertical stack with uniform spacing",
    defaults: { gap: "12px" },
    content: `
      <div class="wf-stack" data-wf-type="stack" data-dev-note="" style="display: flex; flex-direction: column; gap: 12px; width: 100%; box-sizing: border-box;">
        <div style="padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 11px; color: #475569;">Stack Item 1</div>
        <div style="padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 11px; color: #475569;">Stack Item 2</div>
      </div>
    `
  },
  {
    id: "wf-header-bar",
    name: "Header Bar",
    label: "Header Bar",
    category: "layout",
    icon: PanelTop,
    desc: "Standard top application header (56px)",
    defaults: { height: "56px" },
    content: `
      <header class="wf-header-bar" data-wf-type="header-bar" data-dev-note="" style="width: 100%; height: 56px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 24px; height: 24px; background: #0f172a; border-radius: 4px;"></div>
          <strong style="font-size: 14px; color: #0f172a; font-family: sans-serif;">App Title</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="font-size: 12px; color: #64748b; padding: 6px 10px; background: #f1f5f9; border-radius: 3px; border: 1px solid #cbd5e1;">Docs</div>
          <div style="width: 28px; height: 28px; border-radius: 999px; background: #cbd5e1;"></div>
        </div>
      </header>
    `
  },
  {
    id: "wf-sidebar",
    name: "Sidebar",
    label: "Sidebar",
    category: "layout",
    icon: PanelLeft,
    desc: "Standard navigation sidebar (240px wide)",
    defaults: { width: "240px", items: 5 },
    content: `
      <aside class="wf-sidebar" data-wf-type="sidebar" data-dev-note="" style="width: 240px; min-height: 400px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; padding: 12px; box-sizing: border-box;">
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; padding: 6px 8px; margin-bottom: 4px;">Main Menu</div>
        <div style="padding: 8px 10px; background: #e2e8f0; border-radius: 4px; font-size: 12px; font-weight: 600; color: #0f172a;">📊 Dashboard</div>
        <div style="padding: 8px 10px; border-radius: 4px; font-size: 12px; color: #475569;">📁 Projects</div>
        <div style="padding: 8px 10px; border-radius: 4px; font-size: 12px; color: #475569;">👥 Team Members</div>
        <div style="padding: 8px 10px; border-radius: 4px; font-size: 12px; color: #475569;">⚙️ Settings</div>
      </aside>
    `
  },
  {
    id: "wf-topbar-compact",
    name: "Icon-Only Top Bar",
    label: "Icon-Only Top Bar",
    category: "layout",
    icon: PanelTop,
    desc: "Compact header bar with icon action buttons (44px)",
    defaults: { height: "44px" },
    content: `
      <header class="wf-topbar-compact" data-wf-type="topbar-compact" data-dev-note="" style="width: 100%; height: 44px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 24px; height: 24px; background: #0f172a; border-radius: 4px;"></div>
          <span style="font-size: 13px; font-weight: 600; color: #0f172a; font-family: sans-serif;">App</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button style="width: 28px; height: 28px; border-radius: 4px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;">🔍</button>
          <button style="width: 28px; height: 28px; border-radius: 4px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;">🔔</button>
          <button style="width: 28px; height: 28px; border-radius: 4px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;">⚙️</button>
          <div style="width: 26px; height: 26px; border-radius: 999px; background: #cbd5e1; margin-left: 4px;"></div>
        </div>
      </header>
    `
  },
  {
    id: "wf-sidebar-collapsed",
    name: "Icon-Only Sidebar",
    label: "Icon-Only Sidebar",
    category: "layout",
    icon: PanelLeftClose,
    desc: "Compact vertical navigation rail (56px wide)",
    defaults: { width: "56px" },
    content: `
      <aside class="wf-sidebar-collapsed" data-wf-type="sidebar-collapsed" data-dev-note="" style="width: 56px; min-height: 400px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 12px 0; box-sizing: border-box;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
          <div style="width: 32px; height: 32px; background: #0f172a; border-radius: 6px; margin-bottom: 6px;"></div>
          <div style="width: 36px; height: 36px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer;">📊</div>
          <div style="width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #64748b; cursor: pointer;">📁</div>
          <div style="width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #64748b; cursor: pointer;">👥</div>
          <div style="width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #64748b; cursor: pointer;">📑</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;">
          <div style="width: 36px; height: 36px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #64748b; cursor: pointer;">⚙️</div>
          <div style="width: 28px; height: 28px; border-radius: 999px; background: #cbd5e1;"></div>
        </div>
      </aside>
    `
  },
  {
    id: "wf-content-area",
    name: "Content Area",
    label: "Content Area",
    category: "layout",
    icon: Maximize2,
    desc: "Main responsive work area",
    defaults: { flex: "1", padding: "20px" },
    content: `
      <main class="wf-content-area" data-wf-type="content-area" data-dev-note="" style="flex: 1; min-height: 360px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 20px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
        <div style="font-size: 12px; color: #64748b; font-style: italic; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px;">Main Content Region</div>
      </main>
    `
  },
  {
    id: "wf-split-pane",
    name: "Split Pane",
    label: "Split Pane",
    category: "layout",
    icon: SplitSquareVertical,
    desc: "Two-column split view (30% / 70%)",
    defaults: { width: "100%", gap: "16px" },
    content: `
      <div class="wf-split-pane" data-wf-type="split-pane" data-dev-note="" style="width: 100%; min-height: 280px; display: flex; gap: 16px; box-sizing: border-box;">
        <div style="width: 30%; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 12px; font-size: 11px; color: #64748b;">Left Pane (30%)</div>
        <div style="flex: 1; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 12px; font-size: 11px; color: #64748b;">Right Pane (70%)</div>
      </div>
    `
  },
  {
    id: "wf-card",
    name: "Card",
    label: "Card",
    category: "layout",
    icon: Square,
    desc: "Content card with header and body",
    defaults: { width: "100%", padding: "16px" },
    content: `
      <div class="wf-card" data-wf-type="card" data-dev-note="" style="width: 100%; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <strong style="font-size: 13px; color: #0f172a;">Card Title</strong>
          <span style="font-size: 11px; color: #64748b;">Action</span>
        </div>
        <div style="font-size: 12px; color: #475569; line-height: 1.4;">Card body content and structural elements go here.</div>
      </div>
    `
  },
  {
    id: "wf-toolbar",
    name: "Toolbar",
    label: "Toolbar",
    category: "layout",
    icon: Sliders,
    desc: "Action bar for search, filters, and primary buttons",
    defaults: { height: "48px" },
    content: `
      <div class="wf-toolbar" data-wf-type="toolbar" data-dev-note="" style="width: 100%; height: 48px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; box-sizing: border-box;">
        <div style="font-size: 12px; color: #64748b;">Filter / Search Area</div>
        <div style="display: flex; gap: 8px;">
          <button style="padding: 6px 12px; background: #0f172a; color: #ffffff; border: none; border-radius: 3px; font-size: 11px; font-weight: 500;">+ Action</button>
        </div>
      </div>
    `
  },
  {
    id: "wf-footer",
    name: "Footer",
    label: "Footer",
    category: "layout",
    icon: PanelBottom,
    desc: "Application or page footer bar",
    defaults: { height: "40px" },
    content: `
      <footer class="wf-footer" data-wf-type="footer" data-dev-note="" style="width: 100%; height: 40px; border-top: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font-size: 11px; color: #64748b; box-sizing: border-box;">
        <span>© 2026 Organization</span>
        <div style="display: flex; gap: 12px;">
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </footer>
    `
  },
  {
    id: "wf-divider",
    name: "Divider",
    label: "Divider",
    category: "layout",
    icon: Minus,
    desc: "Horizontal line separator",
    defaults: { width: "100%", height: "1px" },
    content: `
      <hr class="wf-divider" data-wf-type="divider" data-dev-note="" style="width: 100%; border: none; border-top: 1px solid #cbd5e1; margin: 12px 0; box-sizing: border-box;" />
    `
  },
  {
    id: "wf-spacer",
    name: "Spacer",
    label: "Spacer",
    category: "layout",
    icon: MoveVertical,
    desc: "Vertical spacing block (24px)",
    defaults: { height: "24px" },
    content: `
      <div class="wf-spacer" data-wf-type="spacer" data-dev-note="" style="width: 100%; height: 24px; border: 1px dashed #e2e8f0; border-radius: 2px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8;">Spacer (24px)</div>
    `
  },

  // ==========================================
  // NAVIGATION
  // ==========================================
  {
    id: "wf-breadcrumb",
    name: "Breadcrumb",
    label: "Breadcrumb",
    category: "navigation",
    icon: ChevronRight,
    desc: "Hierarchical location breadcrumb trail",
    defaults: { text: "Home / Projects / Current Project" },
    content: `
      <nav class="wf-breadcrumb" data-wf-type="breadcrumb" data-dev-note="" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-family: sans-serif;">
        <span style="color: #2563eb; cursor: pointer;">Home</span>
        <span>/</span>
        <span style="color: #2563eb; cursor: pointer;">Projects</span>
        <span>/</span>
        <span style="color: #0f172a; font-weight: 600;">Current Project</span>
      </nav>
    `
  },
  {
    id: "wf-nav-item",
    name: "Navigation Item",
    label: "Navigation Item",
    category: "navigation",
    icon: Navigation,
    desc: "Single navigation link or menu item",
    defaults: { text: "Navigation Item" },
    content: `
      <a href="#" class="wf-nav-item" data-wf-type="nav-item" data-dev-note="" style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; font-weight: 500; color: #0f172a; text-decoration: none; border-radius: 3px; background: #f1f5f9; border: 1px solid #cbd5e1;">
        <span>📌</span>
        <span>Navigation Item</span>
      </a>
    `
  },
  {
    id: "wf-tabs",
    name: "Tabs",
    label: "Tabs",
    category: "navigation",
    icon: Bookmark,
    desc: "Horizontal tab navigation bar",
    defaults: { activeIndex: 0 },
    content: `
      <div class="wf-tabs" data-wf-type="tabs" data-dev-note="" style="width: 100%; display: flex; border-bottom: 1px solid #cbd5e1; gap: 4px; box-sizing: border-box;">
        <div style="padding: 8px 14px; font-size: 12px; font-weight: 600; color: #0f172a; border-bottom: 2px solid #0f172a; margin-bottom: -1px; background: #ffffff;">Overview</div>
        <div style="padding: 8px 14px; font-size: 12px; color: #64748b;">Settings</div>
        <div style="padding: 8px 14px; font-size: 12px; color: #64748b;">Logs</div>
      </div>
    `
  },
  {
    id: "wf-menu",
    name: "Menu",
    label: "Menu",
    category: "navigation",
    icon: Menu,
    desc: "Vertical dropdown or context menu",
    defaults: { width: "160px" },
    content: `
      <div class="wf-menu" data-wf-type="menu" data-dev-note="" style="width: 160px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 4px; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box;">
        <div style="padding: 6px 8px; font-size: 11px; color: #0f172a; border-radius: 2px;">Edit Details</div>
        <div style="padding: 6px 8px; font-size: 11px; color: #0f172a; border-radius: 2px;">Duplicate</div>
        <div style="height: 1px; background: #e2e8f0; margin: 2px 0;"></div>
        <div style="padding: 6px 8px; font-size: 11px; color: #dc2626; border-radius: 2px;">Delete</div>
      </div>
    `
  },
  {
    id: "wf-dropdown",
    name: "Dropdown",
    label: "Dropdown",
    category: "navigation",
    icon: ChevronRight,
    desc: "Dropdown menu trigger and placeholder",
    defaults: { label: "Select Option" },
    content: `
      <div class="wf-dropdown" data-wf-type="dropdown" data-dev-note="" style="display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; min-width: 140px; box-sizing: border-box;">
        <span>Select Option</span>
        <span style="font-size: 10px; color: #64748b;">▼</span>
      </div>
    `
  },
  {
    id: "wf-pagination",
    name: "Pagination",
    label: "Pagination",
    category: "navigation",
    icon: ChevronRight,
    desc: "Page navigation buttons",
    defaults: { pages: 3 },
    content: `
      <div class="wf-pagination" data-wf-type="pagination" data-dev-note="" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px;">
        <button style="padding: 4px 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; color: #64748b;">Prev</button>
        <button style="padding: 4px 8px; background: #0f172a; border: 1px solid #0f172a; border-radius: 3px; color: #ffffff; font-weight: 600;">1</button>
        <button style="padding: 4px 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; color: #64748b;">2</button>
        <button style="padding: 4px 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; color: #64748b;">3</button>
        <button style="padding: 4px 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; color: #64748b;">Next</button>
      </div>
    `
  },
  {
    id: "wf-back-button",
    name: "Back Button",
    label: "Back Button",
    category: "navigation",
    icon: ArrowLeft,
    desc: "Back navigation action button",
    defaults: { label: "Back" },
    content: `
      <button class="wf-back-button" data-wf-type="back-button" data-dev-note="" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; cursor: pointer;">
        <span>←</span>
        <span>Back</span>
      </button>
    `
  },

  // ==========================================
  // CONTROLS
  // ==========================================
  {
    id: "wf-button",
    name: "Button",
    label: "Button",
    category: "controls",
    icon: MousePointerClick,
    desc: "Primary, secondary, or outline button",
    defaults: { text: "Button", variant: "primary", width: "auto" },
    content: `
      <button class="wf-button" data-wf-type="button" data-dev-note="" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; background: #0f172a; color: #ffffff; border: 1px solid #0f172a; border-radius: 3px; font-size: 12px; font-weight: 500; cursor: pointer; min-height: 32px; box-sizing: border-box;">
        Button
      </button>
    `
  },
  {
    id: "wf-icon-button",
    name: "Icon Button",
    label: "Icon Button",
    category: "controls",
    icon: Star,
    desc: "Square icon action button",
    defaults: { width: "32px", height: "32px" },
    content: `
      <button class="wf-icon-button" data-wf-type="icon-button" data-dev-note="" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 14px; color: #0f172a; cursor: pointer; box-sizing: border-box;">
        ⚙️
      </button>
    `
  },
  {
    id: "wf-input",
    name: "Text Input",
    label: "Text Input",
    category: "controls",
    icon: Type,
    desc: "Standard single-line text input field",
    defaults: { placeholder: "Enter text...", width: "100%" },
    content: `
      <div class="wf-input-wrap" data-wf-type="input" data-dev-note="" style="width: 100%; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;">
        <label style="font-size: 11px; font-weight: 600; color: #0f172a;">Label</label>
        <input type="text" placeholder="Enter text..." style="width: 100%; height: 32px; padding: 0 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; box-sizing: border-box;" />
      </div>
    `
  },
  {
    id: "wf-search-input",
    name: "Search Input",
    label: "Search Input",
    category: "controls",
    icon: Search,
    desc: "Search bar with icon and placeholder",
    defaults: { placeholder: "Search..." },
    content: `
      <div class="wf-search-wrap" data-wf-type="search-input" data-dev-note="" style="width: 100%; position: relative; display: flex; align-items: center; box-sizing: border-box;">
        <span style="position: absolute; left: 8px; font-size: 11px; color: #94a3b8;">🔍</span>
        <input type="text" placeholder="Search..." style="width: 100%; height: 32px; padding: 0 10px 0 28px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; box-sizing: border-box;" />
      </div>
    `
  },
  {
    id: "wf-select",
    name: "Select",
    label: "Select",
    category: "controls",
    icon: ListFilter,
    desc: "Select dropdown form control",
    defaults: { label: "Select Option" },
    content: `
      <div class="wf-select-wrap" data-wf-type="select" data-dev-note="" style="width: 100%; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;">
        <label style="font-size: 11px; font-weight: 600; color: #0f172a;">Select Field</label>
        <select style="width: 100%; height: 32px; padding: 0 8px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; box-sizing: border-box;">
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
      </div>
    `
  },
  {
    id: "wf-checkbox",
    name: "Checkbox",
    label: "Checkbox",
    category: "controls",
    icon: CheckSquare,
    desc: "Checkbox option with label",
    defaults: { label: "Checkbox option", checked: true },
    content: `
      <label class="wf-checkbox" data-wf-type="checkbox" data-dev-note="" style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #0f172a; cursor: pointer;">
        <input type="checkbox" checked style="accent-color: #0f172a; cursor: pointer;" />
        <span>Checkbox option</span>
      </label>
    `
  },
  {
    id: "wf-radio",
    name: "Radio",
    label: "Radio",
    category: "controls",
    icon: CircleDot,
    desc: "Radio button option with label",
    defaults: { label: "Radio option" },
    content: `
      <label class="wf-radio" data-wf-type="radio" data-dev-note="" style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #0f172a; cursor: pointer;">
        <input type="radio" checked style="accent-color: #0f172a; cursor: pointer;" />
        <span>Radio option</span>
      </label>
    `
  },
  {
    id: "wf-toggle",
    name: "Toggle",
    label: "Toggle",
    category: "controls",
    icon: ToggleLeft,
    desc: "Switch toggle control",
    defaults: { label: "Enable feature", active: true },
    content: `
      <div class="wf-toggle" data-wf-type="toggle" data-dev-note="" style="display: inline-flex; align-items: center; gap: 10px; font-size: 12px; color: #0f172a;">
        <div style="width: 32px; height: 18px; background: #0f172a; border-radius: 999px; position: relative; padding: 2px; box-sizing: border-box;">
          <div style="width: 14px; height: 14px; background: #ffffff; border-radius: 999px; margin-left: auto;"></div>
        </div>
        <span>Enable feature</span>
      </div>
    `
  },
  {
    id: "wf-date-input",
    name: "Date Input",
    label: "Date Input",
    category: "controls",
    icon: Calendar,
    desc: "Date selection input control",
    defaults: { placeholder: "YYYY-MM-DD" },
    content: `
      <div class="wf-date-wrap" data-wf-type="date-input" data-dev-note="" style="width: 100%; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;">
        <label style="font-size: 11px; font-weight: 600; color: #0f172a;">Date</label>
        <input type="date" style="width: 100%; height: 32px; padding: 0 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; box-sizing: border-box;" />
      </div>
    `
  },
  {
    id: "wf-textarea",
    name: "Textarea",
    label: "Textarea",
    category: "controls",
    icon: AlignLeft,
    desc: "Multi-line text input field",
    defaults: { rows: 3, placeholder: "Enter description..." },
    content: `
      <div class="wf-textarea-wrap" data-wf-type="textarea" data-dev-note="" style="width: 100%; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;">
        <label style="font-size: 11px; font-weight: 600; color: #0f172a;">Description</label>
        <textarea rows="3" placeholder="Enter description..." style="width: 100%; padding: 8px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #0f172a; box-sizing: border-box; resize: vertical;"></textarea>
      </div>
    `
  },

  // ==========================================
  // DATA
  // ==========================================
  {
    id: "wf-data-table",
    name: "Data Table",
    label: "Data Table",
    category: "data",
    icon: Table,
    desc: "Structured data table with headers and rows",
    defaults: { columns: 4, rows: 4, header: true, pagination: true },
    content: `
      <div class="wf-data-table" data-wf-type="data-table" data-dev-note="" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #ffffff; box-sizing: border-box;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 10px 12px; font-weight: 600; color: #0f172a;">ID</th>
              <th style="padding: 10px 12px; font-weight: 600; color: #0f172a;">Name</th>
              <th style="padding: 10px 12px; font-weight: 600; color: #0f172a;">Status</th>
              <th style="padding: 10px 12px; font-weight: 600; color: #0f172a; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 12px; color: #64748b;">#101</td>
              <td style="padding: 10px 12px; color: #0f172a; font-weight: 500;">Alpha Project</td>
              <td style="padding: 10px 12px;"><span style="padding: 2px 6px; background: #dcfce7; color: #166534; border-radius: 3px; font-size: 10px;">Active</span></td>
              <td style="padding: 10px 12px; text-align: right; color: #2563eb;">Edit</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 12px; color: #64748b;">#102</td>
              <td style="padding: 10px 12px; color: #0f172a; font-weight: 500;">Beta Module</td>
              <td style="padding: 10px 12px;"><span style="padding: 2px 6px; background: #fef3c7; color: #92400e; border-radius: 3px; font-size: 10px;">Pending</span></td>
              <td style="padding: 10px 12px; text-align: right; color: #2563eb;">Edit</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; color: #64748b;">#103</td>
              <td style="padding: 10px 12px; color: #0f172a; font-weight: 500;">Gamma Service</td>
              <td style="padding: 10px 12px;"><span style="padding: 2px 6px; background: #fee2e2; color: #991b1b; border-radius: 3px; font-size: 10px;">Offline</span></td>
              <td style="padding: 10px 12px; text-align: right; color: #2563eb;">Edit</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },
  {
    id: "wf-table-column",
    name: "Table Column",
    label: "Table Column",
    category: "data",
    icon: Columns,
    desc: "Single data column cell",
    defaults: { label: "Column Header" },
    content: `
      <th class="wf-table-col" data-wf-type="table-col" data-dev-note="" style="padding: 10px 12px; font-weight: 600; color: #0f172a; background: #f8fafc; border: 1px dashed #cbd5e1;">Column</th>
    `
  },
  {
    id: "wf-table-row",
    name: "Table Row",
    label: "Table Row",
    category: "data",
    icon: Rows,
    desc: "Single data table row",
    defaults: { cells: 4 },
    content: `
      <tr class="wf-table-row" data-wf-type="table-row" data-dev-note="" style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; color: #64748b;">#000</td>
        <td style="padding: 10px 12px; color: #0f172a;">Sample Item</td>
        <td style="padding: 10px 12px; color: #64748b;">Active</td>
        <td style="padding: 10px 12px; text-align: right; color: #2563eb;">View</td>
      </tr>
    `
  },
  {
    id: "wf-list",
    name: "List",
    label: "List",
    category: "data",
    icon: List,
    desc: "Vertical itemized list group",
    defaults: { items: 3 },
    content: `
      <div class="wf-list" data-wf-type="list" data-dev-note="" style="width: 100%; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; divide-y: 1px solid #f1f5f9; box-sizing: border-box;">
        <div style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #0f172a;">List item 1</div>
        <div style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #0f172a;">List item 2</div>
        <div style="padding: 10px 12px; font-size: 12px; color: #0f172a;">List item 3</div>
      </div>
    `
  },
  {
    id: "wf-list-item",
    name: "List Item",
    label: "List Item",
    category: "data",
    icon: List,
    desc: "Single row list item with meta text",
    defaults: { title: "Item Title", subtitle: "Item subtitle" },
    content: `
      <div class="wf-list-item" data-wf-type="list-item" data-dev-note="" style="width: 100%; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; box-sizing: border-box;">
        <div>
          <div style="font-size: 12px; font-weight: 500; color: #0f172a;">Item Title</div>
          <div style="font-size: 10px; color: #64748b;">Subtext / description</div>
        </div>
        <span style="font-size: 11px; color: #2563eb;">›</span>
      </div>
    `
  },
  {
    id: "wf-badge",
    name: "Badge",
    label: "Badge",
    category: "data",
    icon: Tag,
    desc: "Status badge tag",
    defaults: { text: "Badge", color: "blue" },
    content: `
      <span class="wf-badge" data-wf-type="badge" data-dev-note="" style="display: inline-flex; align-items: center; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 999px; font-size: 11px; font-weight: 500;">
        Badge
      </span>
    `
  },
  {
    id: "wf-status-indicator",
    name: "Status Indicator",
    label: "Status Indicator",
    category: "data",
    icon: Activity,
    desc: "Dot status indicator with label",
    defaults: { status: "Active" },
    content: `
      <div class="wf-status" data-wf-type="status-indicator" data-dev-note="" style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #0f172a;">
        <span style="width: 8px; height: 8px; background: #22c55e; border-radius: 999px;"></span>
        <span>Active</span>
      </div>
    `
  },

  // ==========================================
  // FEEDBACK
  // ==========================================
  {
    id: "wf-alert",
    name: "Alert",
    label: "Alert",
    category: "feedback",
    icon: AlertTriangle,
    desc: "Informational or warning alert banner",
    defaults: { type: "info", text: "Alert message text here" },
    content: `
      <div class="wf-alert" data-wf-type="alert" data-dev-note="" style="width: 100%; padding: 12px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; display: flex; align-items: flex-start; gap: 10px; box-sizing: border-box;">
        <span style="font-size: 14px;">ℹ️</span>
        <div>
          <strong style="font-size: 12px; color: #1e3a8a; display: block; margin-bottom: 2px;">Notice</strong>
          <span style="font-size: 11px; color: #1d4ed8;">This is an important feedback or warning notice.</span>
        </div>
      </div>
    `
  },
  {
    id: "wf-toast",
    name: "Toast",
    label: "Toast",
    category: "feedback",
    icon: Bell,
    desc: "Temporary floating toast notification",
    defaults: { text: "Action completed successfully" },
    content: `
      <div class="wf-toast" data-wf-type="toast" data-dev-note="" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; background: #0f172a; color: #ffffff; border-radius: 4px; font-size: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <span>✓</span>
        <span>Changes saved successfully</span>
      </div>
    `
  },
  {
    id: "wf-modal",
    name: "Modal/Dialog",
    label: "Modal/Dialog",
    category: "feedback",
    icon: MessageSquare,
    desc: "Dialog popup with header, body, and actions",
    defaults: { title: "Dialog Title", width: "400px" },
    content: `
      <div class="wf-modal" data-wf-type="modal" data-dev-note="" style="width: 400px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); padding: 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <strong style="font-size: 13px; color: #0f172a;">Modal Title</strong>
          <span style="font-size: 12px; color: #94a3b8; cursor: pointer;">✕</span>
        </div>
        <div style="font-size: 12px; color: #475569; min-height: 48px;">Modal body content and description goes here.</div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          <button style="padding: 6px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 11px; color: #475569;">Cancel</button>
          <button style="padding: 6px 12px; background: #0f172a; border: 1px solid #0f172a; border-radius: 3px; font-size: 11px; color: #ffffff;">Confirm</button>
        </div>
      </div>
    `
  },
  {
    id: "wf-confirm-dialog",
    name: "Confirmation",
    label: "Confirmation",
    category: "feedback",
    icon: CheckCircle,
    desc: "Confirmation prompt with danger/confirm action",
    defaults: { title: "Are you sure?" },
    content: `
      <div class="wf-confirm" data-wf-type="confirm-dialog" data-dev-note="" style="width: 320px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;">
        <strong style="font-size: 12px; color: #0f172a;">Delete Item?</strong>
        <p style="font-size: 11px; color: #64748b; margin: 0;">This action cannot be undone.</p>
        <div style="display: flex; justify-content: flex-end; gap: 6px;">
          <button style="padding: 4px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 11px;">Cancel</button>
          <button style="padding: 4px 10px; background: #dc2626; color: #ffffff; border: none; border-radius: 3px; font-size: 11px;">Delete</button>
        </div>
      </div>
    `
  },
  {
    id: "wf-loading",
    name: "Loading",
    label: "Loading",
    category: "feedback",
    icon: Loader2,
    desc: "Loading spinner or progress indicator",
    defaults: { text: "Loading data..." },
    content: `
      <div class="wf-loading" data-wf-type="loading" data-dev-note="" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px; font-size: 12px; color: #64748b;">
        <span style="font-size: 14px;">⏳</span>
        <span>Loading content...</span>
      </div>
    `
  },
  {
    id: "wf-empty-state",
    name: "Empty State",
    label: "Empty State",
    category: "feedback",
    icon: Inbox,
    desc: "Placeholder container for empty lists or views",
    defaults: { title: "No data available", actionText: "Create Item" },
    content: `
      <div class="wf-empty-state" data-wf-type="empty-state" data-dev-note="" style="width: 100%; padding: 32px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; box-sizing: border-box;">
        <div style="font-size: 24px; color: #94a3b8;">📭</div>
        <strong style="font-size: 13px; color: #0f172a;">No Items Found</strong>
        <span style="font-size: 11px; color: #64748b; max-width: 240px;">Get started by adding your first item or importing data.</span>
        <button style="margin-top: 6px; padding: 6px 14px; background: #0f172a; color: #ffffff; border: none; border-radius: 3px; font-size: 11px;">+ Add Item</button>
      </div>
    `
  },

  // ==========================================
  // CONTENT
  // ==========================================
  {
    id: "wf-heading",
    name: "Heading",
    label: "Heading",
    category: "content",
    icon: Type,
    desc: "Section heading (H1, H2, H3)",
    defaults: { text: "Section Heading", level: "h2" },
    content: `
      <h2 class="wf-heading" data-wf-type="heading" data-dev-note="" style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 8px 0; font-family: sans-serif;">
        Section Heading
      </h2>
    `
  },
  {
    id: "wf-text",
    name: "Text",
    label: "Text",
    category: "content",
    icon: AlignLeft,
    desc: "Body text paragraph or description",
    defaults: { text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
    content: `
      <p class="wf-text" data-wf-type="text" data-dev-note="" style="font-size: 13px; line-height: 1.5; color: #475569; margin: 4px 0; font-family: sans-serif;">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam.
      </p>
    `
  },
  {
    id: "wf-image-placeholder",
    name: "Image Placeholder",
    label: "Image Placeholder",
    category: "content",
    icon: Image,
    desc: "Placeholder block for images or illustrations",
    defaults: { width: "100%", height: "160px" },
    content: `
      <div class="wf-image-placeholder" data-wf-type="image-placeholder" data-dev-note="" style="width: 100%; height: 160px; background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #94a3b8; box-sizing: border-box;">
        <span style="font-size: 20px;">🖼️</span>
        <span style="font-size: 11px;">Image Placeholder</span>
      </div>
    `
  },
  {
    id: "wf-icon",
    name: "Icon",
    label: "Icon",
    category: "content",
    icon: Sparkles,
    desc: "Generic icon placeholder symbol",
    defaults: { size: "20px" },
    content: `
      <span class="wf-icon" data-wf-type="icon" data-dev-note="" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; font-size: 16px; color: #0f172a;">
        ⭐
      </span>
    `
  }
];

export const WIREFRAME_STENCILS = COMPONENT_REGISTRY;
export default COMPONENT_REGISTRY;
