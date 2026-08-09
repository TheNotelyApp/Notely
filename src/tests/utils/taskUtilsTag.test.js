import { describe, it, expect } from "vitest";
import { extractTagsFromText, extractTasksFromText } from "../../utils/taskUtils.js";

describe("taskUtils tag extraction", () => {
  it("extracts hashtags from task strings correctly", () => {
    const text = "Complete project report #work #urgent";
    const tags = extractTagsFromText(text);
    expect(tags).toEqual(["work", "urgent"]);
  });

  it("returns empty array when no hashtags present", () => {
    const text = "Simple task without tags";
    const tags = extractTagsFromText(text);
    expect(tags).toEqual([]);
  });

  it("attaches tags to task objects when parsing markdown task lines", () => {
    const markdown = "- [ ] Finish documentation #docs #v1\n- [x] Fixed bug #bugfix";
    const tasks = extractTasksFromText(markdown);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].tags).toEqual(["docs", "v1"]);
    expect(tasks[1].tags).toEqual(["bugfix"]);
  });
});
