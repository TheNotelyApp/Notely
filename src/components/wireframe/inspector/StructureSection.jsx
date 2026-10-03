import React from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";

export function StructureSection({ isOpen, onToggle }) {
  return (
    <div className={`wireframe-section ${isOpen ? "open" : "collapsed"}`}>
      <button
        type="button"
        className="wireframe-section-header"
        onClick={onToggle}
      >
        <div className="wireframe-section-title-wrap">
          <Layers size={14} />
          <span>Structure</span>
        </div>
        <div className="wireframe-section-chevron">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      <div
        className="wireframe-section-body wireframe-structure-section"
        style={{ display: isOpen ? "block" : "none" }}
      >
        {/* Permanently mounted in DOM so GrapesJS LayerManager never loses container binding */}
        <div className="wireframe-layers-container" />
      </div>
    </div>
  );
}
