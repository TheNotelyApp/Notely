import React, { useState, useEffect, useRef } from "react";
import {
  Minus, Square, Copy, X, Check, ChevronRight, Globe,
  FilePlus, FolderPlus, FolderOpen, Clock, Save, RefreshCw, Package, Edit2, Trash2, ArrowLeft, RotateCcw, Power,
  Undo2, Redo2, Scissors, Clipboard, CheckSquare, Search, Replace, Camera, BookOpen, Command,
  SunMoon, SpellCheck, Palette, Layout, Columns, Maximize2, ZoomIn, ZoomOut, Minimize2, Code,
  Activity, ExternalLink, FolderSearch, GitBranch, GitCommit, History, GitCompare, ArrowUpRight,
  ArrowDownLeft, Network, ShieldAlert, KeyRound, Sparkles, Bot, Brain, Cpu, UserCheck, Stethoscope,
  HelpCircle, Book, Keyboard, MessageSquareWarning, FileTerminal, Info, FileText, Table, Eye, Image as ImageIcon
} from "lucide-react";
import notelyMark from "../../assets/branding/notely-mark.png";

const MENU_ICON_MAP = {
  "new": FilePlus,
  "new note": FilePlus,
  "note": FileText,
  "folder": FolderPlus,
  "open workspace": FolderOpen,
  "open recent": Clock,
  "save": Save,
  "save*": Save,
  "auto save": RefreshCw,
  "export pdf": FileText,
  "export/import note package": Package,
  "rename note": Edit2,
  "reload from disk": RefreshCw,
  "reload workspace from disk": RefreshCw,
  "move note to removed": Trash2,
  "back to notes": ArrowLeft,
  "restart notely": RotateCcw,
  "quit": Power,

  "undo": Undo2,
  "redo": Redo2,
  "cut": Scissors,
  "copy": Copy,
  "paste": Clipboard,
  "select all": CheckSquare,
  "find": Search,
  "find and replace": Replace,
  "screen capture options": Camera,
  "spelling dictionary": BookOpen,

  "open command palette": Command,
  "theme": SunMoon,
  "enable typo check": SpellCheck,
  "set icon & color": Palette,
  "editor layout": Layout,
  "show outline": Layout,
  "split preview": Columns,
  "focus mode": Maximize2,
  "sync split scroll": RefreshCw,
  "table click behavior": Table,
  "preview options": Eye,
  "zoom": ZoomIn,
  "zoom in": ZoomIn,
  "zoom out": ZoomOut,
  "reset zoom": Minimize2,
  "developer": Code,
  "dashboard view": Layout,
  "tile notes": Layout,
  "table notes": Layout,

  "assets library": ImageIcon,
  "workspace activity": Activity,
  "reload workspace": RefreshCw,
  "open workspace in vs code": ExternalLink,
  "reveal workspace in file explorer": FolderSearch,
  "export workspace as zip": Package,
  "open project website": Globe,
  "open current note website view": Globe,

  "open version control": GitBranch,
  "commit…": GitCommit,
  "history": History,
  "diff current note": GitCompare,
  "compare versions": GitCompare,
  "push": ArrowUpRight,
  "pull": ArrowDownLeft,
  "fetch": RefreshCw,
  "sync (pull then push)": RefreshCw,
  "ignore app data in git": GitBranch,

  "p2p status": Activity,
  "run sync self-test": CheckSquare,
  "conflict center": ShieldAlert,
  "rotate workspace keys": KeyRound,
  "how sync works": HelpCircle,

  "open ai palette": Sparkles,
  "ai settings": Bot,
  "knowledge graph": Brain,
  "embeddings": Cpu,
  "personas": UserCheck,
  "diagnostics": Stethoscope,

  "help center": HelpCircle,
  "markdown guide": Book,
  "commit": GitCommit,
  "keyboard shortcuts": Keyboard,
  "report bug / feedback": MessageSquareWarning,
  "system & application logs": FileTerminal,
  "system application logs": FileTerminal,
  "check for updates": RefreshCw,
  "about notely": Info,
};

function getItemIcon(item) {
  if (!item) return null;
  const rawLabel = String(item.label || "").toLowerCase().replace(/&/g, " ").replace(/\s+/g, " ").trim();
  const cleanLabel = rawLabel.replace(/…/g, "").replace(/\.\.\./g, "").trim();
  const roleKey = String(item.role || "").toLowerCase().trim();

  let IconComponent = MENU_ICON_MAP[cleanLabel] || MENU_ICON_MAP[rawLabel] || MENU_ICON_MAP[roleKey];

  if (!IconComponent) {
    if (rawLabel.includes("asset")) {
      IconComponent = ImageIcon;
    } else if (rawLabel.includes("log")) {
      IconComponent = FileTerminal;
    } else if (rawLabel.includes("move") && rawLabel.includes("removed")) {
      IconComponent = Trash2;
    } else if (rawLabel.includes("commit")) {
      IconComponent = GitCommit;
    } else if (rawLabel.includes("workspace") && (rawLabel.includes("remove") || rawLabel.includes("delete"))) {
      IconComponent = Trash2;
    } else if (rawLabel.includes("workspace")) {
      IconComponent = FolderOpen;
    } else if (rawLabel.includes("recent")) {
      IconComponent = Clock;
    } else if (rawLabel.includes("export") || rawLabel.includes("import")) {
      IconComponent = Package;
    } else if (rawLabel.includes("theme")) {
      IconComponent = SunMoon;
    } else if (rawLabel.includes("zoom")) {
      IconComponent = ZoomIn;
    } else if (rawLabel.includes("reload") || rawLabel.includes("refresh")) {
      IconComponent = RefreshCw;
    } else if (rawLabel.includes("remove") || rawLabel.includes("delete") || rawLabel.includes("trash")) {
      IconComponent = Trash2;
    }
  }

  if (!IconComponent) return null;
  return <IconComponent size={12} className="titlebar-menu-item-icon" />;
}

export function TitleBar({ title = "Notely", onOpenWebsite }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [menuStructure, setMenuStructure] = useState([]);
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const [activeSubmenuPath, setActiveSubmenuPath] = useState([]); // Array of indexes tracing active submenus

  const containerRef = useRef(null);

  useEffect(() => {
    // Check initial maximized state
    if (window.notesApi?.isWindowMaximized) {
      window.notesApi.isWindowMaximized().then(setIsMaximized).catch(() => {});
    }

    const loadMenuStructure = () => {
      if (window.notesApi?.getMenuStructure) {
        window.notesApi.getMenuStructure().then(setMenuStructure).catch(() => {});
      }
    };

    // Fetch initial dynamic menu structure
    loadMenuStructure();

    // Subscribe to menu updates from main process
    let unsubscribeMenu = () => {};
    if (window.notesApi?.onMenuUpdated) {
      unsubscribeMenu = window.notesApi.onMenuUpdated(loadMenuStructure);
    }

    // Subscribe to state changes from main process
    let unsubscribeMax = () => {};
    if (window.notesApi?.onWindowMaximizedChanged) {
      unsubscribeMax = window.notesApi.onWindowMaximizedChanged((maximized) => {
        setIsMaximized(maximized);
      });
    }

    return () => {
      unsubscribeMenu();
      unsubscribeMax();
    };
  }, []);

  // Handle clicking outside to close menus
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeAllMenus();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeAllMenus();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const closeAllMenus = () => {
    setActiveMenuIndex(null);
    setActiveSubmenuPath([]);
  };

  const handleMinimize = () => {
    window.notesApi?.minimizeWindow?.();
  };

  const handleMaximize = () => {
    window.notesApi?.maximizeWindow?.();
  };

  const handleClose = () => {
    window.notesApi?.closeWindow?.();
  };

  const handleTopLevelClick = (index) => {
    if (activeMenuIndex === index) {
      closeAllMenus();
    } else {
      setActiveMenuIndex(index);
      setActiveSubmenuPath([]);
    }
  };

  const handleTopLevelMouseEnter = (index) => {
    if (activeMenuIndex !== null) {
      setActiveMenuIndex(index);
      setActiveSubmenuPath([]);
    }
  };

  const handleItemClick = (item, indexPath) => {
    if (item.enabled === false) return;
    if (item.submenu) return; // Submenus open on hover/interaction

    window.notesApi?.executeMenuItem?.({
      indexPath
    });
    closeAllMenus();
  };

  // Helper to format shortcuts/accelerators (e.g. CmdOrCtrl+N -> Ctrl+N)
  const formatAccelerator = (acc) => {
    if (!acc) return "";
    const isMac = navigator.userAgent.toLowerCase().includes("mac");
    return acc
      .replace(/CmdOrCtrl\+/gi, isMac ? "⌘" : "Ctrl+")
      .replace(/Shift\+/gi, isMac ? "⇧" : "Shift+")
      .replace(/Alt\+/gi, isMac ? "⌥" : "Alt+");
  };

  const getLabel = (item) => {
    if (item.label) return item.label.replace(/&/g, "");
    if (item.role) {
      const roleLabels = {
        undo: "Undo",
        redo: "Redo",
        cut: "Cut",
        copy: "Copy",
        paste: "Paste",
        selectall: "Select All",
        reload: "Reload",
        forcereload: "Force Reload",
        toggledevtools: "Toggle Developer Tools",
        togglefullscreen: "Toggle Full Screen",
        minimize: "Minimize",
        close: "Close"
      };
      const normalized = item.role.toLowerCase();
      return roleLabels[normalized] || item.role.charAt(0).toUpperCase() + item.role.slice(1);
    }
    return "";
  };

  // Recursive submenu renderer
  const renderDropdownItems = (items, path = []) => {
    return (
      <ul className="titlebar-dropdown-list">
        {items.map((item, index) => {
          if (item.type === "separator") {
            return <li key={`sep-${index}`} className="titlebar-menu-separator" />;
          }

          const currentPath = [...path, index];
          const hasSubmenu = !!item.submenu;
          const isSubmenuOpen = activeSubmenuPath.length > path.length && activeSubmenuPath[path.length] === index;

          const handleMouseEnter = () => {
            const newPath = [...path, index];
            setActiveSubmenuPath(newPath);
          };

          return (
            <li
              key={item.label || index}
              className={`titlebar-menu-item${item.enabled === false ? " disabled" : ""}${hasSubmenu ? " has-submenu" : ""}`}
              onMouseEnter={handleMouseEnter}
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(item, currentPath);
              }}
            >
              <div className="titlebar-menu-item-check">
                {item.checked ? <Check size={12} /> : getItemIcon(item)}
              </div>
              <span className="titlebar-menu-item-label">
                {getLabel(item)}
              </span>
              {item.accelerator && (
                <span className="titlebar-menu-item-shortcut">
                  {formatAccelerator(item.accelerator)}
                </span>
              )}
              {hasSubmenu && (
                <ChevronRight className="titlebar-menu-item-chevron" size={12} />
              )}

              {hasSubmenu && isSubmenuOpen && (
                <div className="titlebar-submenu">
                  {renderDropdownItems(item.submenu, currentPath)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <header className="app-titlebar" ref={containerRef} onDoubleClick={handleMaximize}>
      <div className="titlebar-left">
        <div className="titlebar-brand">
          <img src={notelyMark} alt="Notely logo" className="titlebar-brand-icon" style={{ width: "16px", height: "16px", objectFit: "contain" }} />
          <span>Notely</span>
        </div>

        <div className="titlebar-menu">
          {menuStructure.map((menu, index) => {
            const isOpen = activeMenuIndex === index;
            return (
              <div key={menu.label || index} className={`titlebar-menu-container${isOpen ? " open" : ""}`}>
                <button
                  className="titlebar-menu-btn"
                  type="button"
                  onClick={() => handleTopLevelClick(index)}
                  onMouseEnter={() => handleTopLevelMouseEnter(index)}
                >
                  {menu.label ? menu.label.replace(/&/g, "") : ""}
                </button>
                {isOpen && menu.submenu && (
                  <div className="titlebar-dropdown">
                    {renderDropdownItems(menu.submenu, [index])}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="titlebar-title">{title}</div>

      <div className="titlebar-controls">
        {onOpenWebsite && (
          <button
            className="titlebar-btn web-view"
            onClick={onOpenWebsite}
            type="button"
            title="Open Website View"
            aria-label="Open Website View"
            style={{ marginRight: "4px" }}
          >
            <Globe size={14} />
          </button>
        )}
        <button
          className="titlebar-btn minimize"
          onClick={handleMinimize}
          type="button"
          aria-label="Minimize Window"
        >
          <Minus size={14} />
        </button>
        <button
          className="titlebar-btn maximize"
          onClick={handleMaximize}
          type="button"
          aria-label={isMaximized ? "Restore Window" : "Maximize Window"}
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          className="titlebar-btn close"
          onClick={handleClose}
          type="button"
          aria-label="Close Window"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
