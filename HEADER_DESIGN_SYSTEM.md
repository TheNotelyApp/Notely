# Notely Header Design System

This document outlines the consistent header styling patterns used across the Notely application.

## Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Primary Text | `#14292c` / `#0f2a2f` | Main headers |
| Secondary Text | `#5f747a` / `#63767b` | Subtitles, metadata |
| Light Gray Text | `#9bb6bf` | Terminal/monospace text |
| Borders | `#d9dedb` / `#d9e3df` / `#dbe6e1` | Header bottom borders |
| Background Light | `#f7fbf9` / `#ffffff` | Header backgrounds |
| Background Gradient | Gradient from `#f7fbf9` → `#ffffff` | Dialog headers |
| Dark Terminal | Linear gradient `#183138` → `#112228` | Terminal header |
| Accent Primary | `#2f5d62` | Links, focus states |

## Font Sizing

| Size | Usage |
|------|-------|
| `26px` | Landing page header (h1) |
| `18px` | Document and modal headers (h2, h1) |
| `15px` | Media usage dialog header (h3) |
| `14px` | AI Palette title, AI Settings header |
| `13px` | Section headers, stats headers |
| `12px` | Subtitle text |
| `11px` | Group headers, labels |
| `10px` | File metadata, small text |

## Spacing Standards

| Property | Value | Usage |
|----------|-------|-------|
| Padding (Standard) | `8px 10px` | Document header |
| Padding (Generous) | `14px 16px` | Dialog headers |
| Padding (Compact) | `4px 10px` | Embedded terminal header |
| Gap Between Items | `8px` / `10px` / `12px` | Flexbox layouts |
| Border Radius | `8px` / `10px` / `14px` / `16px` | Headers and modals |

---

## Header Styles by Component

### 1. **Document Header** (`.doc-header`)
**Location:** DocumentDetail.jsx
```css
.doc-header {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 2.2fr);
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #d9dedb;
  border-radius: 8px;
  background: #ffffff;
  align-items: center;
}

.doc-header h1 {
  margin: 0;
  font-size: 18px;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.doc-header-file {
  margin: 2px 0 0;
  color: #63767b;
  font-size: 10px;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
```
**Design Pattern:**
- Grid layout with 2 columns (title section + actions)
- White background with subtle border
- Title: `18px`, Filename metadata: `10px` gray
- Includes action buttons on the right
- Used for document editing view header

---

### 2. **Landing Page Header** (`.landing-header`)
**Location:** DocumentList.jsx
```css
.landing-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
  padding: 14px 16px;
  border: 1px solid #cfdbd6;
  border-radius: 14px;
  background:
    radial-gradient(circle at top right, rgba(141, 191, 174, 0.2), transparent 38%),
    linear-gradient(140deg, #fcfefd 0%, #f2f8f5 100%);
  box-shadow: 0 14px 28px rgba(16, 34, 36, 0.09);
  flex-shrink: 0;
}

.landing-header h1 {
  margin: 0;
  font-size: 26px;
  color: #0f2a2f;
  line-height: 1.1;
}
```
**Design Pattern:**
- Larger hero header with gradient background
- `26px` heading size
- Contains decorative radial gradient overlay
- Subtle shadow for depth
- Flex layout for title and controls

---

### 3. **Embedded Terminal Header** (`.embedded-terminal-header`)
**Location:** EmbeddedTerminal.jsx
```css
.embedded-terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  padding: 4px 10px;
  border-bottom: 1px solid #284047;
  background: linear-gradient(180deg, #183138 0%, #112228 100%);
}

.embedded-terminal-header strong {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d8ece2;
}

.embedded-terminal-header span {
  color: #9bb6bf;
  font-size: 10px;
  font-family: "Cascadia Code", Consolas, ui-monospace, monospace;
  max-width: 40vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```
**Design Pattern:**
- Dark gradient background for terminal context
- Very compact (`28px` min-height)
- Monospace font family for terminal text
- Light text on dark background (#d8ece2 for labels)
- Ellipsis for long paths

---

### 4. **AI Palette Header** (`.ai-palette-header`)
**Location:** AIPalette.jsx
```css
.ai-palette-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #dbe6e1;
  background: linear-gradient(135deg, #17343a 0%, #2f5d62 100%);
  color: #f4fbf8;
}

.ai-palette-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ai-palette-subtitle {
  margin-top: 3px;
  color: rgba(244, 251, 248, 0.72);
  font-size: 12px;
}
```
**Design Pattern:**
- Teal/dark green gradient background
- Light text (#f4fbf8) for contrast
- `14px` uppercase title with increased letter-spacing
- `12px` subtitle with semi-transparent color
- Used for AI-specific panels

---

### 5. **AI Settings Header** (`.ai-settings-dialog-header`)
**Location:** AISettings.jsx
```css
.ai-settings-dialog-header {
  padding: 8px 12px;
  border-bottom: 1px solid #d9e3df;
  background: linear-gradient(180deg, #f7fbf9 0%, #ffffff 100%);
}

.ai-settings-title-group h2 {
  margin: 0;
  font-size: 14px;
  color: #14292c;
}

.ai-settings-title-group p {
  margin: 0;
  font-size: 12px;
  color: #5f747a;
}
```
**Design Pattern:**
- Light gradient background (#f7fbf9 → #ffffff)
- Compact padding (`8px 12px`)
- `14px` title, `12px` subtitle
- Subtle gray metadata text
- Dialog-style header

---

### 6. **Assets Dialog Header** (`.assets-dialog-header`)
**Location:** Modal dialogs for media management
```css
.assets-dialog-header {
  padding: 14px 16px;
  border-bottom: 1px solid #d9e3df;
  background: linear-gradient(180deg, #f7fbf9 0%, #ffffff 100%);
}

.assets-dialog-title-group h2 {
  margin: 0;
  font-size: 18px;
  color: #14292c;
}

.assets-dialog-title-group p {
  margin: 0;
  font-size: 12px;
  color: #5f747a;
}
```
**Design Pattern:**
- Same gradient as AI Settings
- Larger padding (`14px 16px`)
- `18px` title for prominence
- Title + subtitle layout
- Used for asset/media dialogs

---

### 7. **Global Search Header** (`.global-search-header`)
**Location:** GlobalSearchOverlay.jsx
```css
.global-search-header {
  display: flex;
  align-items: center;
}

.global-search-input {
  width: 100%;
  min-height: 44px;
  border: 1px solid #d2ddd9;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: #163238;
}

.global-search-input:focus {
  outline: 2px solid #4f7f8a;
  outline-offset: 1px;
}
```
**Design Pattern:**
- Search input takes full width
- `44px` min-height for touch-friendly interaction
- `10px` border-radius (rounded)
- Light border with blue focus state
- Flex layout for growth

---

### 8. **Command Palette Header** (`.command-palette-header`)
**Location:** CommandPalette.jsx
```css
.command-palette-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.command-palette-input {
  width: 100%;
  min-height: 42px;
  border: 1px solid #d2ddd9;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: #173038;
}

.command-palette-input:focus {
  outline: 2px solid #4f7f8a;
  outline-offset: 1px;
}
```
**Design Pattern:**
- Similar to search header
- `42px` min-height
- Compact gap (`8px`) for hint/help text
- Light border and blue focus outline

---

### 9. **Image Crop Modal Header** (`.image-crop-header`)
**Location:** ImageCropModal.jsx
```css
.image-crop-header {
  padding: 12px 14px;
  border-bottom: 1px solid #e3ece8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.image-crop-header h3 {
  margin: 0;
  font-size: 15px;
  color: #143237;
}

.image-crop-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #5d757b;
}
```
**Design Pattern:**
- Moderate padding (`12px 14px`)
- `15px` title, `12px` subtitle
- Flex layout with close button alignment
- Clean, minimal design

---

### 10. **Overlay Dialog Header** (`.overlay-dialog-header`)
**Location:** Generic dialog overlays
```css
.overlay-dialog-header,
.overlay-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.overlay-dialog-header h2 {
  margin: 0;
  font-size: 18px;
}
```
**Design Pattern:**
- Flex layout with space-between for title and close button
- `18px` heading
- `10px` gap between elements

---

### 11. **Workspace Graph Header** (`.workspace-graph-header`)
**Location:** WorkspaceGraphPanel.jsx
```css
.workspace-graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e5e5;
  background: #ffffff;
  flex-shrink: 0;
}

.workspace-graph-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text, #172326);
  flex: 0;
  letter-spacing: -0.3px;
}
```
**Design Pattern:**
- Generous padding (`20px 24px`)
- Clean white background
- `1.1rem` heading with tight letter-spacing (-0.3px)
- Uses CSS variables for theming support
- Full-width component header

---

### 12. **Command Palette Group Header** (`.command-palette-group-header`)
**Location:** CommandPalette.jsx
```css
.command-palette-group-header {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #4f656d;
  background: #f3f8f6;
  border-bottom: 1px solid #dce7e3;
}
```
**Design Pattern:**
- Sticky positioning for scroll
- Very compact (`11px` font)
- Uppercase with letter-spacing
- Light gray background and text

---

### 13. **Media Usage Header** (`.media-usage-header`)
**Location:** Media statistics panel
```css
.media-usage-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid #dbe6e1;
  background: #f8fbfa;
}

.media-usage-header h3 {
  margin: 0;
  color: #17343a;
  font-size: 15px;
}

.media-usage-header p {
  margin: 4px 0 0;
  color: #60767c;
  font-family: "Cascadia Code", Consolas, ui-monospace, monospace;
  font-size: 11px;
}
```
**Design Pattern:**
- Light background (#f8fbfa)
- Flex layout with space-between
- `15px` title, `11px` monospace subtitle
- Used for stats and metadata

---

### 14. **Stats Header** (`.stats-header`)
**Location:** Media statistics
```css
.stats-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #1a3a3e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```
**Design Pattern:**
- Very compact (`13px`)
- Uppercase with letter-spacing
- Bold font-weight (700)
- Subtle text color

---

### 15. **Document Card Header** (`.document-card-header`)
**Location:** DocumentList.jsx items
```css
.document-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
```
**Design Pattern:**
- Flex row layout
- Space-between for title and actions
- `10px` gap

---

## Design Principles

### Color Scheme
1. **Primary Text:** Dark blue-gray (#14292c, #0f2a2f, #143237)
2. **Secondary Text:** Medium gray (#5f747a, #60767c)
3. **Borders:** Light gray (#d9dedb, #dbe6e1)
4. **Backgrounds:** White to off-white gradient (#f7fbf9 → #ffffff)
5. **Accents:** Teal/dark green (#2f5d62, #17343a)
6. **Dark Contexts:** Very dark blue-gray (#183138, #112228) for terminals

### Typography
- **Title:** `14px` - `26px` depending on context
- **Subtitle:** `12px` gray for metadata
- **Monospace:** "Cascadia Code", Consolas for technical content
- **Letter-spacing:** `0.04em` - `0.08em` for uppercase labels

### Spacing
- **Compact:** `4px 10px` (terminal header)
- **Standard:** `8px 10px` - `12px 14px` (document headers)
- **Generous:** `14px 16px` - `20px 24px` (dialog headers)

### Borders & Radius
- **Border:** `1px solid` in light gray
- **Radius:** `8px` - `16px` (8px for small elements, 14px for major components)
- **Divider:** Subtle line between header and content

### Layout Patterns
1. **Flex Row:** For horizontal distribution (title + actions)
2. **Grid:** For multi-column layouts (document header)
3. **Space-between:** For aligning title left, actions right
4. **Sticky:** For group headers that scroll with content

---

## Responsive Adjustments

### Mobile Breakpoint (max-width: 820px)
```css
.assets-dialog-header {
  padding: 12px 13px;  /* Reduced from 14px 16px */
}
```
- Reduced padding on mobile
- Headers maintain same font sizes for readability
- Flex layouts adapt naturally

---

## Implementation Guidelines

When creating a new header component:

1. **Choose a background style:**
   - White (`#ffffff`)
   - Light gradient (`#f7fbf9` → `#ffffff`)
   - Dark gradient (for AI/terminal contexts)

2. **Set appropriate padding:**
   - Compact: `4px 10px`
   - Standard: `8px 10px` - `12px 14px`
   - Generous: `14px 16px` - `20px 24px`

3. **Use standard border:**
   - `1px solid #d9dedb` or `#dbe6e1`
   - `border-radius: 8px` - `10px`

4. **Font sizing hierarchy:**
   - Title: `14px` - `18px`
   - Subtitle: `12px`
   - Metadata: `10px` - `11px`

5. **Color text appropriately:**
   - Primary: `#14292c` (dark)
   - Secondary: `#5f747a` (gray)
   - Light: `#9bb6bf` (for dark backgrounds)

6. **Layout pattern:**
   - Use `display: flex` for linear headers
   - Use `display: grid` for multi-section headers
   - Apply `justify-content: space-between` for title + actions
