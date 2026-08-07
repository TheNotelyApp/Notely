import { describe, it, expect } from "vitest";
import { renderTaskLinks, renderMarkdown } from "../../utils/renderUtils";

describe("renderTaskLinks", () => {
  it("transforms open markdown task list item into clickable button", () => {
    const rawMarkdown = "- [ ] Buy milk";
    const rendered = renderMarkdown(rawMarkdown);
    expect(rendered).toContain("task-preview-link open");
    expect(rendered).toContain('data-task-status="open"');
    expect(rendered).toContain('data-task-title="Buy milk"');
    expect(rendered).toContain("<span class=\"task-checkbox-icon\">[ ]</span>");
  });

  it("transforms closed markdown task list item into completed button", () => {
    const rawMarkdown = "- [x] Finish documentation";
    const rendered = renderMarkdown(rawMarkdown);
    expect(rendered).toContain("task-preview-link done");
    expect(rendered).toContain('data-task-status="done"');
    expect(rendered).toContain('data-task-title="Finish documentation"');
    expect(rendered).toContain("<span class=\"task-checkbox-icon\">[x]</span>");
  });

  it("transforms standalone paragraph tasks without list bullets", () => {
    const rawMarkdown = "[ ] Standalone open task";
    const rendered = renderMarkdown(rawMarkdown);
    expect(rendered).toContain("task-paragraph-item");
    expect(rendered).toContain("task-preview-link open");
    expect(rendered).toContain('data-task-title="Standalone open task"');
  });

  it("does not transform checkbox syntax inside code blocks", () => {
    const rawMarkdown = "```js\nconst code = '[ ] Not a task';\n```";
    const rendered = renderMarkdown(rawMarkdown);
    expect(rendered).not.toContain("task-preview-link");
    expect(rendered).toContain("[ ] Not a task");
  });

  it("preserves HTML markup inside task content", () => {
    const rawMarkdown = "- [ ] **Important** task";
    const rendered = renderMarkdown(rawMarkdown);
    expect(rendered).toContain('data-task-title="Important task"');
    expect(rendered).toContain("<strong>Important</strong> task");
  });
});
