import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { TYPE_COLORS, RELATIONSHIP_COLORS, getTypeColor } from './graphUtils';

export default function GraphCanvasView({
  nodes = [],
  edges = [],
  onNodeClick,
  onNodeDoubleClick,
  showEdgeLabels = true,
  searchQuery = '',
  selectedNode = null
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Viewport transformation state: scale, translation
  const [transform, setTransform] = useState({ scale: 1.0, x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [minDegree, setMinDegree] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Build quick neighbor adjacency index for instantaneous hover highlighting
  const { adjacencyMap, nodePositions, edgeList } = useMemo(() => {
    const adj = new Map();
    const pos = [];
    const validIds = new Set();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const deg = n.degree || 0;
      if (deg < minDegree && (!searchQuery.trim() || !n.name?.toLowerCase().includes(searchQuery.toLowerCase()))) {
        continue;
      }

      validIds.add(n.id);
      adj.set(n.id, new Set([n.id]));
      
      let x = typeof n.pos_x === 'number' && !isNaN(n.pos_x) ? n.pos_x : (typeof n.position?.x === 'number' && !isNaN(n.position.x) ? n.position.x : null);
      let y = typeof n.pos_y === 'number' && !isNaN(n.pos_y) ? n.pos_y : (typeof n.position?.y === 'number' && !isNaN(n.position.y) ? n.position.y : null);

      if (x === null || y === null) {
        // Deterministic organic phyllotaxis distribution fallback so nodes without cached coordinates don't collapse to a single point
        const angle = i * 2.3999632;
        const dist = 90 + Math.sqrt(i) * 70;
        x = 500 + Math.cos(angle) * dist;
        y = 400 + Math.sin(angle) * dist;
      }

      const radius = Math.max(16, Math.min(36, 16 + deg * 2.4));

      pos.push({
        id: n.id,
        raw: n.data?.raw || n,
        x,
        y,
        radius,
        degree: deg,
        type: n.data?.raw?.type || n.type || 'Entity',
        name: n.data?.raw?.name || n.name || n.canonical_name || 'Node'
      });
    }

    const filteredEdges = [];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const src = e.source_id || e.source;
      const tgt = e.target_id || e.target;
      if (validIds.has(src) && validIds.has(tgt)) {
        adj.get(src)?.add(tgt);
        adj.get(tgt)?.add(src);
        filteredEdges.push({
          source: src,
          target: tgt,
          type: e.type || 'RELATION',
          rawLabel: e.label || e.rawLabel || e.type
        });
      }
    }

    return {
      adjacencyMap: adj,
      nodePositions: pos,
      edgeList: filteredEdges
    };
  }, [nodes, edges, minDegree, searchQuery]);

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDims = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setDimensions(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };

    updateDims();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit view helper
  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el || nodePositions.length === 0) return;
    const w = el.clientWidth || dimensions.width || 800;
    const h = el.clientHeight || dimensions.height || 600;
    if (w <= 10 || h <= 10) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let validCount = 0;

    for (let i = 0; i < nodePositions.length; i++) {
      const n = nodePositions[i];
      if (typeof n.x === 'number' && Number.isFinite(n.x) && typeof n.y === 'number' && Number.isFinite(n.y)) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
        validCount++;
      }
    }

    if (validCount === 0 || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
      setTransform({ scale: 1.0, x: 0, y: 0 });
      return;
    }

    if (minX === maxX) {
      minX -= 150;
      maxX += 150;
    }
    if (minY === maxY) {
      minY -= 150;
      maxY += 150;
    }

    const padding = 100;
    const graphW = Math.max(100, maxX - minX + padding * 2);
    const graphH = Math.max(100, maxY - minY + padding * 2);

    let scale = Math.min(w / graphW, h / graphH);
    if (!Number.isFinite(scale) || scale <= 0) scale = 1.0;
    scale = Math.min(1.4, Math.max(0.15, scale));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let tx = w / 2 - centerX * scale;
    let ty = h / 2 - centerY * scale;

    if (!Number.isFinite(tx)) tx = 0;
    if (!Number.isFinite(ty)) ty = 0;

    setTransform({ scale, x: tx, y: ty });
  }, [nodePositions, dimensions.width, dimensions.height]);

  const lastFittedNodesRef = useRef(null);

  // Auto-fit view when new nodes arrive or container dimensions are first resolved
  useEffect(() => {
    if (nodes.length > 0 && dimensions.width > 0 && dimensions.height > 0) {
      if (lastFittedNodesRef.current !== nodes) {
        lastFittedNodesRef.current = nodes;
        fitView();
      }
    }
  }, [nodes, dimensions.width, dimensions.height, fitView]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerRef.current.clientWidth || dimensions.width || 800;
    const h = containerRef.current.clientHeight || dimensions.height || 600;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const safeScale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1.0;
    const safeTx = Number.isFinite(transform.x) ? transform.x : 0;
    const safeTy = Number.isFinite(transform.y) ? transform.y : 0;

    // 0. Draw subtle dynamic background grid dots
    const gridSize = 32 * safeScale;
    if (gridSize >= 12) {
      const offsetX = ((safeTx % gridSize) + gridSize) % gridSize;
      const offsetY = ((safeTy % gridSize) + gridSize) % gridSize;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let x = offsetX; x < w; x += gridSize) {
        for (let y = offsetY; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.translate(safeTx, safeTy);
    ctx.scale(safeScale, safeScale);

    const activeHoverSet = hoveredNode ? adjacencyMap.get(hoveredNode.id) : null;
    const isSearching = !!searchQuery.trim();
    const searchLower = searchQuery.toLowerCase().trim();

    // Map for fast coordinate lookup
    const posMap = new Map(nodePositions.map(n => [n.id, n]));

    // 1. Draw Edges
    for (let i = 0; i < edgeList.length; i++) {
      const edge = edgeList[i];
      const srcNode = posMap.get(edge.source);
      const tgtNode = posMap.get(edge.target);
      if (!srcNode || !tgtNode) continue;

      const relTypeUpper = String(edge.type || 'RELATION').toUpperCase();
      const isMentions = relTypeUpper === 'MENTIONS' || relTypeUpper === 'MENTIONS_NOTE';
      const edgeColor = RELATIONSHIP_COLORS[relTypeUpper] || RELATIONSHIP_COLORS.DEFAULT;

      // Determine opacity based on hover/search
      let opacity = 0.55;
      const isConnected = hoveredNode && (edge.source === hoveredNode.id || edge.target === hoveredNode.id);
      if (hoveredNode) {
        opacity = isConnected ? 1.0 : 0.06;
      } else if (isSearching) {
        const srcMatch = srcNode.name.toLowerCase().includes(searchLower);
        const tgtMatch = tgtNode.name.toLowerCase().includes(searchLower);
        opacity = srcMatch || tgtMatch ? 0.95 : 0.1;
      }

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = isMentions ? 'rgba(160, 160, 160, 0.4)' : edgeColor;
      ctx.lineWidth = isMentions ? 1.0 : (isConnected ? 2.5 : 1.4);

      if (isMentions) {
        ctx.setLineDash([4, 4]);
      }

      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(srcNode.x, srcNode.y);
      ctx.lineTo(tgtNode.x, tgtNode.y);
      ctx.stroke();

      // Draw directional arrow near target
      const angle = Math.atan2(tgtNode.y - srcNode.y, tgtNode.x - srcNode.x);
      const arrowDist = tgtNode.radius + 6;
      const arrowX = tgtNode.x - arrowDist * Math.cos(angle);
      const arrowY = tgtNode.y - arrowDist * Math.sin(angle);
      const arrowSize = 6;

      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Draw edge label pill when zoomed in
      if (showEdgeLabels && safeScale >= 0.75 && !isMentions && edge.rawLabel) {
        const midX = (srcNode.x + tgtNode.x) / 2;
        const midY = (srcNode.y + tgtNode.y) / 2;
        const labelText = String(edge.rawLabel).replace(/_/g, ' ').toLowerCase();

        ctx.font = '600 7px system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(labelText).width;

        // Label pill background
        ctx.fillStyle = 'rgba(18, 22, 28, 0.9)';
        ctx.strokeStyle = `${edgeColor}66`;
        ctx.lineWidth = 0.5;
        const pillW = textWidth + 8;
        const pillH = 12;
        const pillR = 3;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, pillR);
        } else {
          ctx.rect(midX - pillW / 2, midY - pillH / 2, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, midX, midY);
      }

      ctx.restore();
    }

    // 2. Draw Nodes
    for (let i = 0; i < nodePositions.length; i++) {
      const node = nodePositions[i];
      const typeStyle = TYPE_COLORS[node.type] || getTypeColor(node.type);
      const isSelected = selectedNode && selectedNode.id === node.id;
      const isHovered = hoveredNode && hoveredNode.id === node.id;
      const isHub = node.degree >= 5;

      let opacity = 1.0;
      if (hoveredNode) {
        opacity = activeHoverSet?.has(node.id) ? 1.0 : 0.12;
      } else if (isSearching) {
        const match = node.name.toLowerCase().includes(searchLower) || String(node.type || '').toLowerCase().includes(searchLower);
        opacity = match ? 1.0 : 0.12;
      }

      ctx.save();
      ctx.globalAlpha = opacity;

      // Outer glow on selected or hovered node
      if (isSelected || isHovered) {
        ctx.shadowColor = typeStyle.border || '#2f5d62';
        ctx.shadowBlur = isSelected ? 16 : 10;
      }

      // Hub outer pulse ring
      if (isHub || isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isSelected ? 5 : 3), 0, Math.PI * 2);
        ctx.strokeStyle = typeStyle.border || '#2f5d62';
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        ctx.stroke();
      }

      // Circle Fill & Border
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = typeStyle.background || 'rgba(47, 93, 98, 0.2)';
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow for crisp stroke
      ctx.strokeStyle = typeStyle.border || '#2f5d62';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Node Entity Type Indicator Dot
      ctx.beginPath();
      ctx.arc(node.x, node.y - node.radius * 0.38, isHub ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = typeStyle.border || '#2f5d62';
      ctx.fill();

      // Label (LOD: Level of Detail)
      const showLabel = safeScale >= 0.45 || isHub || isHovered || isSelected;
      if (showLabel) {
        const textColor = typeStyle.border || '#2f5d62';

        // 1. Small uppercase category tag above node name
        if (safeScale >= 0.65 || isHovered || isSelected) {
          ctx.font = '800 5.5px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = textColor;
          const typeLabel = String(node.type || 'Entity').toUpperCase();
          ctx.fillText(typeLabel.slice(0, 10), node.x, node.y - node.radius * 0.38);
        }

        // 2. Main node name with high contrast color
        const fontSize = Math.max(7.5, Math.min(10.5, Math.round(node.radius * 0.42)));
        ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;

        // Auto truncate label
        let displayName = String(node.name || 'Node');
        if (displayName.length > 14) {
          displayName = displayName.slice(0, 12) + '…';
        }

        const textY = (safeScale >= 0.65 || isHovered || isSelected) ? node.y + (node.radius > 16 ? 3.5 : 2) : node.y;
        ctx.fillText(displayName, node.x, textY);

        // 3. Node degree badge on hubs
        if (node.degree > 0 && safeScale >= 0.55) {
          const badgeX = node.x + node.radius * 0.72;
          const badgeY = node.y + node.radius * 0.72;
          const badgeRadius = 6.5;

          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.strokeStyle = `${textColor}88`;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = '800 6.5px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = textColor;
          ctx.fillText(`${node.degree}`, badgeX, badgeY + 0.5);
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }, [nodePositions, edgeList, transform, hoveredNode, adjacencyMap, showEdgeLabels, searchQuery, selectedNode, dimensions]);

  // Mouse / Pointer Event Handlers
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setTransform(prev => {
      const newScale = Math.max(0.06, Math.min(4.0, prev.scale * zoomFactor));
      const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
      const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);
      return { scale: newScale, x: newX, y: newY };
    });
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const findNodeAtScreenPos = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const { scale, x: tx, y: ty } = transformRef.current;
    const canvasX = (clientX - rect.left - tx) / scale;
    const canvasY = (clientY - rect.top - ty) / scale;

    for (let i = nodePositions.length - 1; i >= 0; i--) {
      const node = nodePositions[i];
      const dx = canvasX - node.x;
      const dy = canvasY - node.y;
      const hitRadius = Math.max(node.radius, 18);
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  }, [nodePositions]);

  const handleMouseMove = useCallback((e) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    } else {
      const found = findNodeAtScreenPos(e.clientX, e.clientY);
      setHoveredNode(found);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = found ? 'pointer' : 'grab';
      }
    }
  }, [findNodeAtScreenPos]);

  const handleMouseUp = useCallback((e) => {
    isDraggingRef.current = false;
    const moved = Math.abs(e.clientX - dragStartRef.current.x) + Math.abs(e.clientY - dragStartRef.current.y);
    if (moved < 5) {
      const clicked = findNodeAtScreenPos(e.clientX, e.clientY);
      if (clicked && typeof onNodeClick === 'function') {
        onNodeClick(clicked.raw);
      }
    }
  }, [findNodeAtScreenPos, onNodeClick]);

  const handleDoubleClick = useCallback((e) => {
    const clicked = findNodeAtScreenPos(e.clientX, e.clientY);
    if (clicked && typeof onNodeDoubleClick === 'function') {
      onNodeDoubleClick(clicked.raw);
    }
  }, [findNodeAtScreenPos, onNodeDoubleClick]);

  // Setup non-passive wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  const zoomPercent = Math.round(transform.scale * 100);

  return (
    <div
      ref={containerRef}
      className="kg-canvas-viewport"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--app-bg, #0f141c)'
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={() => {
          isDraggingRef.current = false;
          setHoveredNode(null);
        }}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'grab'
        }}
      />

      {/* Floating Canvas Controls */}
      <div
        className="kg-canvas-controls"
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--surface-elevated, #1a202c)',
          border: '1px solid var(--border-default, #2d3748)',
          borderRadius: 'var(--radius-default)',
          padding: '4px 6px',
          boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.3))',
          zIndex: 10
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #718096)', padding: '0 4px', minWidth: '34px', textAlign: 'center' }}>
          {zoomPercent}%
        </span>

        <span style={{ width: 1, height: 14, background: 'var(--border-soft, #2d3748)' }} />

        <button
          className="btn btn-tertiary btn-sm"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(4.0, prev.scale * 1.25) }))}
          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="btn btn-tertiary btn-sm"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.06, prev.scale * 0.8) }))}
          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="btn btn-tertiary btn-sm"
          onClick={fitView}
          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Fit Graph to Screen"
        >
          <Maximize2 size={14} />
        </button>
        <button
          className="btn btn-tertiary btn-sm"
          onClick={() => setTransform({ scale: 1.0, x: 0, y: 0 })}
          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Reset Zoom"
        >
          <RotateCcw size={14} />
        </button>

        <span style={{ width: 1, height: 14, background: 'var(--border-soft, #2d3748)' }} />

        <button
          className={`btn btn-tertiary btn-sm ${showFilterPanel ? 'active' : ''}`}
          onClick={() => setShowFilterPanel(prev => !prev)}
          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: minDegree > 0 ? 'var(--accent-solid)' : undefined }}
          title="Filter by node connectivity"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {/* Connectivity Density Filter Popover */}
      {showFilterPanel && (
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            right: 16,
            background: 'var(--surface-elevated, #1a202c)',
            border: '1px solid var(--border-default, #2d3748)',
            borderRadius: 'var(--radius-default)',
            padding: '10px 14px',
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.4))',
            zIndex: 11,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 190
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-strong)' }}>Min Connections</span>
            <strong style={{ fontSize: '11px', color: 'var(--accent-solid)' }}>{minDegree}+</strong>
          </div>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={minDegree}
            onChange={(e) => setMinDegree(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-solid)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {minDegree === 0 ? 'Showing all nodes' : `Showing nodes with $\\ge ${minDegree}$ links`}
          </span>
        </div>
      )}
    </div>
  );
}
