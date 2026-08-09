import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Workspace Graph","description":"Explore links and relations between your notes using the visual workspace graph.","frontmatter":{"title":"Workspace Graph","description":"Explore links and relations between your notes using the visual workspace graph.","keywords":"graph, workspace graph, node link, connections, semantic clustering","category":"Workspace"},"headers":[],"relativePath":"workspace/graph.md","filePath":"workspace/graph.md","lastUpdated":1783855203000}');
const _sfc_main = { name: "workspace/graph.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="workspace-graph" tabindex="-1">Workspace Graph <a class="header-anchor" href="#workspace-graph" aria-label="Permalink to &quot;Workspace Graph&quot;">​</a></h1><p>The Workspace Graph is an interactive visualizer that maps notes and media files, helping you discover connections and trace relationships.</p><h2 id="_1-navigating-the-graph" tabindex="-1">1. Navigating the Graph <a class="header-anchor" href="#_1-navigating-the-graph" aria-label="Permalink to &quot;1. Navigating the Graph&quot;">​</a></h2><p>Open the graph from <strong>Workspace → Workspace Graph</strong>:</p><ul><li>Zoom and pan using the mouse wheel/drag.</li><li>Click and drag nodes to rearrange the visual layout.</li><li>Hover over nodes to highlight their direct neighbors.</li><li>Click a note node to open that note directly.</li></ul><hr><h2 id="_2-node-types" tabindex="-1">2. Node Types <a class="header-anchor" href="#_2-node-types" aria-label="Permalink to &quot;2. Node Types&quot;">​</a></h2><ul><li><strong>Note Nodes</strong>: Represent Markdown files.</li><li><strong>Media Nodes</strong>: Represent images, PDFs, and assets referenced by notes.</li><li><strong>Disconnected Nodes</strong>: Represent orphan notes containing no links.</li></ul><hr><h2 id="_3-semantic-clustering-ai-powered" tabindex="-1">3. Semantic Clustering (AI-Powered) <a class="header-anchor" href="#_3-semantic-clustering-ai-powered" aria-label="Permalink to &quot;3. Semantic Clustering (AI-Powered)&quot;">​</a></h2><p>When AI features are active, the graph clusters related notes using semantic similarity. If the clustering falls out of date, click <strong>Refresh</strong> to rebuild the semantic relations.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("workspace/graph.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const graph = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  graph as default
};
