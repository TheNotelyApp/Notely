import { describe, it, expect } from "vitest";
import { renderCallouts } from "../../utils/renderUtils";

describe("GitHub-Style Callouts Parser", () => {
  it("transforms > [!NOTE] blockquote to styled callout container", () => {
    const rawHtml = "<blockquote><p>[!NOTE]<br>This is a test note callout.</p></blockquote>";
    const rendered = renderCallouts(rawHtml);
    expect(rendered).toContain('class="notely-callout callout-note"');
    expect(rendered).toContain('class="notely-callout-title">Note</span>');
    expect(rendered).toContain("This is a test note callout.");
  });

  it("transforms > [!WARNING] blockquote to warning callout container", () => {
    const rawHtml = "<blockquote><p>[!WARNING]<br>High priority alert!</p></blockquote>";
    const rendered = renderCallouts(rawHtml);
    expect(rendered).toContain('class="notely-callout callout-warning"');
    expect(rendered).toContain('class="notely-callout-title">Warning</span>');
    expect(rendered).toContain("High priority alert!");
  });

  it("transforms > [!TIP] blockquote to tip callout container", () => {
    const rawHtml = "<blockquote><p>[!TIP]<br>Useful tip text.</p></blockquote>";
    const rendered = renderCallouts(rawHtml);
    expect(rendered).toContain('class="notely-callout callout-tip"');
    expect(rendered).toContain('class="notely-callout-title">Tip</span>');
  });

  it("transforms > [!TODO] blockquote to todo callout container", () => {
    const rawHtml = "<blockquote><p>[!TODO]<br>Task to complete.</p></blockquote>";
    const rendered = renderCallouts(rawHtml);
    expect(rendered).toContain('class="notely-callout callout-todo"');
    expect(rendered).toContain('class="notely-callout-title">Todo</span>');
  });

  it("transforms blockquotes containing data-source-line attributes", () => {
    const rawHtml = '<blockquote data-source-line="5"><p data-source-line="5">[!NOTE]<br>Callout with attributes.</p></blockquote>';
    const rendered = renderCallouts(rawHtml);
    expect(rendered).toContain('class="notely-callout callout-note"');
    expect(rendered).toContain("Callout with attributes.");
  });

  it("leaves standard blockquotes unmodified", () => {
    const rawHtml = "<blockquote><p>Standard blockquote quote.</p></blockquote>";
    const rendered = renderCallouts(rawHtml);
    expect(rendered).toBe(rawHtml);
  });
});
