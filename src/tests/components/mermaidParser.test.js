import { describe, it, expect } from "vitest";
import { parseMermaidToFlow, generateMermaidFromFlow } from "../../components/mermaid/mermaidParser";

describe("mermaidParser", () => {
  it("should parse flowchart code into React Flow nodes and edges", () => {
    const code = `flowchart TD
    A["Start Task"] -->|Next| B("In Progress")
    B --> C{"Is Done?"}
    C -->|Yes| D(("Complete"))`;

    const { nodes, edges, direction } = parseMermaidToFlow(code);

    expect(direction).toBe("TD");
    expect(nodes.length).toBe(4);
    expect(edges.length).toBe(3);

    const nodeA = nodes.find((n) => n.id === "A");
    expect(nodeA).toBeDefined();
    expect(nodeA.data.label).toBe("Start Task");
    expect(nodeA.data.shape).toBe("rectangle");

    const nodeB = nodes.find((n) => n.id === "B");
    expect(nodeB.data.shape).toBe("rounded");

    const nodeC = nodes.find((n) => n.id === "C");
    expect(nodeC.data.shape).toBe("diamond");

    const nodeD = nodes.find((n) => n.id === "D");
    expect(nodeD.data.shape).toBe("circle");

    expect(edges[0].source).toBe("A");
    expect(edges[0].target).toBe("B");
    expect(edges[0].label).toBe("Next");
  });

  it("should parse extended shapes and line styles", () => {
    const code = `flowchart LR
    S(["Start Event"]) ==>|Thick| P[["Subroutine Process"]]
    P -.->|Dashed| E(("End"))
    style S fill:#1e3a8a,stroke:#3b82f6,color:#ffffff`;

    const { nodes, edges } = parseMermaidToFlow(code);

    const nodeS = nodes.find((n) => n.id === "S");
    expect(nodeS.data.shape).toBe("stadium");
    expect(nodeS.data.fillColor).toBe("#1e3a8a");

    const nodeP = nodes.find((n) => n.id === "P");
    expect(nodeP.data.shape).toBe("subroutine");

    expect(edges[0].data.lineStyle).toBe("thick");
    expect(edges[1].data.lineStyle).toBe("dashed");
  });

  it("should generate valid Mermaid code with style directives and line types", () => {
    const nodes = [
      { id: "A", data: { label: "Start", shape: "stadium", fillColor: "#1e3a8a", strokeColor: "#3b82f6" } },
      { id: "B", data: { label: "Decision", shape: "diamond" } },
    ];
    const edges = [
      { id: "e1", source: "A", target: "B", label: "Proceed", data: { lineStyle: "thick" } },
    ];

    const mermaidCode = generateMermaidFromFlow(nodes, edges, "LR");

    expect(mermaidCode).toContain("flowchart LR");
    expect(mermaidCode).toContain('A(["Start"])');
    expect(mermaidCode).toContain('B{"Decision"}');
    expect(mermaidCode).toContain("A ==>|Proceed| B");
    expect(mermaidCode).toContain("style A fill:#1e3a8a,stroke:#3b82f6");
  });

  it("should fallback gracefully for empty inputs", () => {
    const { nodes, edges } = parseMermaidToFlow("");
    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);
  });
});
