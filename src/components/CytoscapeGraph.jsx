import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import cytoscape from "cytoscape";
import coseLayout from "cytoscape-cose-bilkent";
import { FileText, Folder, File, Image, Music, Video } from "lucide-react";
import "./CytoscapeGraph.css";

cytoscape.use(coseLayout);

// Color palette for folders
const PALETTE = [
  "#a8d5ba", "#f4c7a8", "#aac4e0", "#e8b4b8", "#c5b8e8",
  "#f6e49a", "#b8dce8", "#e8d0a9", "#b8e8d0", "#e8c5b8",
  "#c8e8a8", "#e8b8d0", "#a8c8e8", "#e8e0a8", "#b8a8e8",
];

function folderColor(folder, folderIndex) {
  const idx = folderIndex % PALETTE.length;
  return PALETTE[idx];
}

function getMediaIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return "🖼";
  if (['mp3', 'wav', 'm4a'].includes(ext)) return "🎵";
  if (['mp4', 'webm', 'mov'].includes(ext)) return "🎬";
  return "📎";
}

export function CytoscapeGraph({
  rawData,
  filter,
  clusters,
  showMedia,
  onNodeClick,
  onOpenDocument,
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  // Build folder color map
  const folderColorMap = useMemo(() => {
    if (!rawData?.nodes) return new Map();
    const folders = [...new Set(rawData.nodes.map((n) => n.folder || "."))];
    const map = new Map();
    folders.forEach((f, i) => map.set(f, folderColor(f, i)));
    return map;
  }, [rawData]);

  // Filter nodes based on media visibility and search
  const filteredNodes = useMemo(() => {
    if (!rawData?.nodes) return [];
    let nodes = rawData.nodes;
    
    if (!showMedia) {
      nodes = nodes.filter(n => n.nodeType !== 'media');
    }
    
    const q = filter.trim().toLowerCase();
    if (q) {
      nodes = nodes.filter(
        (n) => n.label.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q)
      );
    }
    
    return nodes;
  }, [rawData, showMedia, filter]);

  // Build Cytoscape elements
  const cytoscapeElements = useMemo(() => {
    if (!filteredNodes.length) return [];
    
    const filteredIds = new Set(filteredNodes.map(n => n.id));
    
    // Create nodes
    const nodes = filteredNodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        type: node.nodeType || 'note',
        folder: node.folder || '.',
        color: node.nodeType === 'media' 
          ? '#ccc' 
          : folderColorMap.get(node.folder || '.') || '#a8d5ba',
        relativePath: node.relativePath || '',
      }
    }));

    // Create edges (only between visible nodes)
    const edges = (rawData?.edges || [])
      .filter(e => filteredIds.has(e.source) && filteredIds.has(e.target))
      .map(edge => ({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
        }
      }));

    return [...nodes, ...edges];
  }, [filteredNodes, rawData, folderColorMap]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: cytoscapeElements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)',
            'color': '#172326',
            'text-opacity': 1,
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 10,
            'font-weight': 'bold',
            'padding': '8px',
            'border-width': 2,
            'border-color': '#fff',
            'border-opacity': 0,
            'width': 'label',
            'height': 'label',
            'min-width': 70,
            'min-height': 40,
            'text-wrap': 'wrap',
            'text-max-width': 80,
          }
        },
        {
          selector: 'node[type = "media"]',
          style: {
            'background-color': 'rgba(200, 200, 200, 0.2)',
            'border-style': 'dashed',
            'border-width': 2,
            'border-color': '#999',
            'opacity': 0.8,
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#2f5d62',
            'box-shadow': '0 0 8px rgba(47, 93, 98, 0.4)',
            'z-index': 10,
          }
        },
        {
          selector: 'node:hover',
          style: {
            'box-shadow': '0 0 12px rgba(0, 0, 0, 0.2)',
            'z-index': 9,
          }
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#d0cbc0',
            'width': 2,
            'curve-style': 'bezier',
            'opacity': 0.6,
            'target-arrow-color': '#d0cbc0',
            'target-arrow-shape': 'none',
          }
        },
        {
          selector: 'edge:hover',
          style: {
            'line-color': '#2f5d62',
            'width': 3,
            'opacity': 0.9,
            'z-index': 8,
          }
        },
      ],
      layout: {
        name: 'cose',
        directed: false,
        animate: 'end',
        animationDuration: 500,
        avoidOverlap: true,
        nodeSeparation: 100,
        nodeSpacing: 20,
        gravity: 0.25,
        numIter: 2500,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 0.0001,
      },
      wheelSensitivity: 0.1,
      pixelRatio: 'auto',
    });

    cyRef.current = cy;

    // Node click handler
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      setSelectedId(node.id());
      if (onNodeClick) onNodeClick(node.id());
    });

    // Node double click to open
    let lastTap = 0;
    cy.on('tap', 'node', (event) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        const node = event.target.data();
        if (node.type === 'note' && onOpenDocument) {
          onOpenDocument(node.relativePath);
        }
      }
      lastTap = now;
    });

    // Pane click to deselect
    cy.on('tap', (event) => {
      if (event.target === cy) {
        setSelectedId(null);
      }
    });

    // Fit view on initial load
    cy.fit(undefined, 50);

    return () => {
      cy.removeAllListeners();
      cy.destroy();
    };
  }, [cytoscapeElements, onNodeClick, onOpenDocument]);

  return <div ref={containerRef} className="cytoscape-graph-container" />;
}
