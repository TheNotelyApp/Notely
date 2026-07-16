import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, RotateCcw } from "lucide-react";
import { OverlayDialog } from "./OverlayDialog";
import { getContrastColor } from "../utils/colorUtils";
import * as LucideIcons from "lucide-react";
import "../styles/IconColorPickerModal.css";

const COMMON_ICONS = [
  "Folder", "File", "Star", "Heart", "Zap", "Briefcase", "Code", "Image",
  "Music", "Video", "Globe", "Map", "Calendar", "Camera", "Book", "Clock",
  "Flag", "Key", "Lock", "Mail", "MessageCircle", "Package", "Phone",
  "Shield", "ShoppingCart", "Tag", "Target", "Terminal", "Tool", "User"
];

function hexToRgba(hex, alpha) {
  if (!hex) return "";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaToHexAndAlpha(rgbaStr) {
  if (!rgbaStr || !rgbaStr.startsWith("rgba")) return { hex: "#888888", alpha: 1 };
  const parts = rgbaStr.match(/[\d.]+/g);
  if (!parts || parts.length < 4) return { hex: "#888888", alpha: 1 };
  const r = parseInt(parts[0], 10).toString(16).padStart(2, "0");
  const g = parseInt(parts[1], 10).toString(16).padStart(2, "0");
  const b = parseInt(parts[2], 10).toString(16).padStart(2, "0");
  return { hex: `#${r}${g}${b}`, alpha: parseFloat(parts[3]) };
}

export function IconColorPickerModal({ isOpen, onClose, initialIcon, initialColor, onSave, targetName }) {
  const [selectedIcon, setSelectedIcon] = useState(initialIcon || "");
  const [hexColor, setHexColor] = useState("#888888");
  const [alpha, setAlpha] = useState(1);

  useEffect(() => {
    setSelectedIcon(initialIcon || "");
    if (initialColor && initialColor.startsWith("rgba")) {
      const { hex, alpha: a } = rgbaToHexAndAlpha(initialColor);
      setHexColor(hex);
      setAlpha(a);
    } else if (initialColor && initialColor.startsWith("#")) {
      setHexColor(initialColor.slice(0, 7));
      setAlpha(1);
    } else {
      setHexColor("#888888");
      setAlpha(1);
    }
  }, [initialIcon, initialColor, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const finalColor = alpha < 1 ? hexToRgba(hexColor, alpha) : hexColor;
    onSave({
      icon: selectedIcon || null,
      color: hexColor !== "#888888" || alpha < 1 ? finalColor : null
    });
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: "Customization saved successfully", type: "success" } }));
    onClose();
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the icon and color customization?")) {
      onSave({ icon: null, color: null });
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: "Customization cleared", type: "info" } }));
      onClose();
    }
  };

  return createPortal(
    <OverlayDialog
      open={isOpen}
      onClose={onClose}
      ariaLabel={`Customize ${targetName || "Item"}`}
      cardClassName="icon-color-picker-card"
    >
      <div className="overlay-dialog-header">
        <h2>Customize {targetName || "Item"}</h2>
        <button className="icon-button" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>

      <div className="overlay-dialog-body icon-color-picker-body">
        <div className="picker-section">
          <h3>Icon</h3>
          <div className="icon-grid">
            <button
              type="button"
              className={`icon-grid-item ${selectedIcon === "" ? "selected" : ""}`}
              style={selectedIcon === "" ? { 
                backgroundColor: alpha < 1 ? hexToRgba(hexColor, alpha) : hexColor, 
                color: getContrastColor(alpha < 1 ? hexToRgba(hexColor, alpha) : hexColor),
                borderColor: 'transparent'
              } : {}}
              onClick={() => setSelectedIcon("")}
              title="Default"
            >
              None
            </button>
            {COMMON_ICONS.map(iconName => {
              const IconComp = LucideIcons[iconName];
              if (!IconComp) return null;
              return (
                <button
                  key={iconName}
                  type="button"
                  className={`icon-grid-item ${selectedIcon === iconName ? "selected" : ""}`}
                  style={selectedIcon === iconName ? { 
                    backgroundColor: alpha < 1 ? hexToRgba(hexColor, alpha) : hexColor, 
                    color: getContrastColor(alpha < 1 ? hexToRgba(hexColor, alpha) : hexColor),
                    borderColor: 'transparent'
                  } : {}}
                  onClick={() => setSelectedIcon(iconName)}
                  title={iconName}
                >
                  <IconComp size={20} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="picker-section">
          <h3>Color & Opacity</h3>
          <div className="color-controls">
            <div className="color-row">
              <label htmlFor="color-input">Color:</label>
              <input
                id="color-input"
                type="color"
                value={hexColor}
                onChange={(e) => setHexColor(e.target.value)}
              />
              <span className="color-hex">{hexColor}</span>
            </div>
            <div className="color-row">
              <label htmlFor="opacity-input">Opacity:</label>
              <input
                id="opacity-input"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
              />
              <span>{Math.round(alpha * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <button type="button" className="icon-modal-btn secondary" onClick={handleClear}>
          <RotateCcw size={16} /> Clear Customization
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="icon-modal-btn primary" onClick={handleSave}>
          <Check size={16} /> Save
        </button>
      </div>
    </OverlayDialog>,
    document.getElementById('root') || document.body
  );
}
