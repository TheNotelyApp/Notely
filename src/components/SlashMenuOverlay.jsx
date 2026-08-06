import React, { useEffect, useRef, useState } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Info,
  AlertTriangle,
  Lightbulb,
  Star,
  Table,
  Code,
  Workflow,
  Palette,
  Calendar,
  Minus,
  Quote,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import "../styles/SlashMenuOverlay.css";

const SLASH_COMMANDS = [
  {
    id: "ai-summarize",
    label: "AI: Summarize Block",
    description: "Summarize this block briefly using AI",
    icon: Wand2,
    isAI: true,
    prompt: "Summarize the following text briefly. Return only the summary text without introduction: ",
    keywords: ["ai", "summarize", "summary", "shorten"],
  },
  {
    id: "ai-grammar",
    label: "AI: Fix Grammar",
    description: "Fix spelling and grammar errors using AI",
    icon: Sparkles,
    isAI: true,
    prompt: "Fix grammar, spelling, and punctuation errors in the following text, keeping the meaning identical. Return only the corrected text: ",
    keywords: ["ai", "grammar", "spelling", "fix", "proofread"],
  },
  {
    id: "ai-tasks",
    label: "AI: Extract Tasks",
    description: "Convert text to checklist tasks using AI",
    icon: CheckSquare,
    isAI: true,
    prompt: "Extract any action items or tasks from the following text and format them as a markdown task list (- [ ] task). Return only the tasks: ",
    keywords: ["ai", "tasks", "action", "extract", "todo"],
  },
  {
    id: "ai-professional",
    label: "AI: Make Professional",
    description: "Rewrite block in professional tone using AI",
    icon: Sparkles,
    isAI: true,
    prompt: "Rewrite the following text in a professional, clear, and business-appropriate tone. Return only the rewritten text: ",
    keywords: ["ai", "professional", "tone", "formal", "rewrite"],
  },
  {
    id: "ai-casual",
    label: "AI: Make Casual",
    description: "Rewrite block in casual tone using AI",
    icon: Sparkles,
    isAI: true,
    prompt: "Rewrite the following text in a casual, friendly, and conversational tone. Return only the rewritten text: ",
    keywords: ["ai", "casual", "friendly", "tone", "rewrite"],
  },
  {
    id: "h1",
    label: "Heading 1",
    description: "Big section heading",
    icon: Heading1,
    snippet: "# ",
    keywords: ["h1", "heading", "title", "header"],
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    snippet: "## ",
    keywords: ["h2", "heading", "subtitle", "header"],
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    snippet: "### ",
    keywords: ["h3", "heading", "subheading", "header"],
  },
  {
    id: "bullet",
    label: "Bullet List",
    description: "Simple bulleted item",
    icon: List,
    snippet: "- ",
    keywords: ["bullet", "list", "unordered", "item"],
  },
  {
    id: "numbered",
    label: "Numbered List",
    description: "Sequential numbered item",
    icon: ListOrdered,
    snippet: "1. ",
    keywords: ["numbered", "list", "ordered", "number"],
  },
  {
    id: "task",
    label: "Task List",
    description: "Trackable checkbox task",
    icon: CheckSquare,
    snippet: "- [ ] ",
    keywords: ["task", "todo", "checkbox", "done"],
  },
  {
    id: "callout-note",
    label: "Callout - Note",
    description: "Informational note box",
    icon: Info,
    snippet: "> [!NOTE]\n> ",
    keywords: ["note", "callout", "info", "box"],
  },
  {
    id: "callout-warning",
    label: "Callout - Warning",
    description: "Alert warning box",
    icon: AlertTriangle,
    snippet: "> [!WARNING]\n> ",
    keywords: ["warning", "callout", "alert", "danger"],
  },
  {
    id: "callout-tip",
    label: "Callout - Tip",
    description: "Helpful tip advice box",
    icon: Lightbulb,
    snippet: "> [!TIP]\n> ",
    keywords: ["tip", "callout", "advice", "lightbulb"],
  },
  {
    id: "callout-todo",
    label: "Callout - Todo",
    description: "Action item task box",
    icon: CheckSquare,
    snippet: "> [!TODO]\n> ",
    keywords: ["todo", "callout", "action", "task"],
  },
  {
    id: "callout-important",
    label: "Callout - Important",
    description: "Crucial highlight box",
    icon: Star,
    snippet: "> [!IMPORTANT]\n> ",
    keywords: ["important", "callout", "star", "highlight"],
  },
  {
    id: "table",
    label: "Table",
    description: "Insert 3x3 Markdown table",
    icon: Table,
    snippet: "| Header 1 | Header 2 | Header 3 |\n| :--- | :---: | ---: |\n| Cell 1 | Cell 2 | Cell 3 |\n",
    keywords: ["table", "grid", "matrix", "column", "row"],
  },
  {
    id: "code",
    label: "Code Block",
    description: "Syntax highlighted code snippet",
    icon: Code,
    snippet: "```javascript\n\n```\n",
    keywords: ["code", "snippet", "js", "python", "block"],
  },
  {
    id: "mermaid",
    label: "Mermaid Diagram",
    description: "Flowchart or sequence diagram",
    icon: Workflow,
    snippet: "```mermaid\ngraph TD\n  A[Start] --> B[Process]\n  B --> C[End]\n```\n",
    keywords: ["mermaid", "diagram", "flowchart", "graph"],
  },
  {
    id: "date",
    label: "Today's Date",
    description: "Insert current date string",
    icon: Calendar,
    getSnippet: () => new Date().toISOString().split("T")[0],
    keywords: ["date", "today", "now", "calendar", "time"],
  },
  {
    id: "hr",
    label: "Divider",
    description: "Horizontal line separator",
    icon: Minus,
    snippet: "\n---\n",
    keywords: ["divider", "line", "rule", "hr", "separator"],
  },
  {
    id: "quote",
    label: "Quote",
    description: "Blockquote paragraph",
    icon: Quote,
    snippet: "> ",
    keywords: ["quote", "blockquote", "cite"],
  },
];

export default function SlashMenuOverlay({
  isOpen,
  filterQuery = "",
  position = { top: 0, left: 0 },
  onSelectCommand,
  onClose,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef(null);

  const filteredCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase().trim();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q))
    );
  });

  const listRef = useRef(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterQuery]);

  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex];
    if (selectedEl && typeof selectedEl.scrollIntoView === "function") {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (filteredCommands.length ? (prev + 1) % filteredCommands.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (filteredCommands.length ? (prev - 1 + filteredCommands.length) % filteredCommands.length : 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCommands[selectedIndex]) {
          const cmd = filteredCommands[selectedIndex];
          const text = cmd.getSnippet ? cmd.getSnippet() : cmd.snippet;
          onSelectCommand(text, cmd);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, filteredCommands, selectedIndex, onSelectCommand, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="slash-menu-overlay"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
      }}
    >
      <div className="slash-menu-header">
        <span className="slash-menu-title">Commands</span>
        {filterQuery && <span className="slash-menu-filter">Matching: /{filterQuery}</span>}
      </div>
      <div className="slash-menu-list" ref={listRef}>
        {filteredCommands.length === 0 ? (
          <div className="slash-menu-empty">No matching commands</div>
        ) : (
          filteredCommands.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                type="button"
                className={`slash-menu-item ${isSelected ? "selected" : ""} ${cmd.isAI ? "ai-command" : ""}`}
                onClick={() => {
                  const text = cmd.getSnippet ? cmd.getSnippet() : cmd.snippet;
                  onSelectCommand(text, cmd);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="slash-menu-item-icon">
                  <Icon size={16} />
                </div>
                <div className="slash-menu-item-info">
                  <span className="slash-menu-item-label">{cmd.label}</span>
                  <span className="slash-menu-item-desc">{cmd.description}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
