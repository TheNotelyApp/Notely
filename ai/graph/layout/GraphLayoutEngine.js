/**
 * GraphLayoutEngine
 * Pure mathematical / physical force simulation layout calculator.
 * Independent of SQLite / IPC layers for clean modularity and testing.
 */

const d3Force = require('d3-force');

class GraphLayoutEngine {
  /**
   * Compute 2D coordinates and connectivity degree for graph nodes
   * @param {Array<Object>} entities - List of entity objects with id
   * @param {Array<Object>} relationships - List of relationship objects with source_id and target_id
   * @param {Object} options - Force layout configuration
   * @returns {{ nodes: Array<Object>, positions: Map<string, {x: number, y: number, degree: number}> }}
   */
  static computeLayout(entities = [], relationships = [], options = {}) {
    if (!Array.isArray(entities) || entities.length === 0) {
      return { nodes: [], positions: new Map() };
    }

    const {
      width = 1000,
      height = 800,
      ticks = Math.min(100, Math.max(30, Math.round(entities.length * 0.8))),
      baseDistance = 140,
      baseCharge = -280,
      baseCollision = 60
    } = options;

    // 1. Calculate connectivity degree per entity
    const degrees = new Map();
    for (const ent of entities) {
      degrees.set(ent.id, 0);
    }
    for (const rel of relationships) {
      if (degrees.has(rel.source_id)) {
        degrees.set(rel.source_id, degrees.get(rel.source_id) + 1);
      }
      if (degrees.has(rel.target_id)) {
        degrees.set(rel.target_id, degrees.get(rel.target_id) + 1);
      }
    }

    // 2. Prepare nodes for force simulation
    const entityIds = new Set(entities.map(e => e.id));
    const forceNodes = entities.map((entity, idx) => {
      // Preserve existing valid positions if available, otherwise distribute around center
      const hasValidX = typeof entity.pos_x === 'number' && !isNaN(entity.pos_x);
      const hasValidY = typeof entity.pos_y === 'number' && !isNaN(entity.pos_y);

      return {
        id: entity.id,
        entity,
        degree: degrees.get(entity.id) || 0,
        x: hasValidX ? entity.pos_x : (width / 2) + (Math.random() - 0.5) * (width * 0.7),
        y: hasValidY ? entity.pos_y : (height / 2) + (Math.random() - 0.5) * (height * 0.7),
        index: idx
      };
    });

    // 3. Prepare filtered links
    const forceLinks = relationships
      .filter(rel => entityIds.has(rel.source_id) && entityIds.has(rel.target_id))
      .map(rel => ({
        source: rel.source_id,
        target: rel.target_id,
        weight: rel.weight || 1.0
      }));

    // 4. Configure dynamic forces based on graph scale
    const nodeCount = forceNodes.length;
    const dynamicDistance = Math.max(80, Math.min(300, baseDistance + (nodeCount > 100 ? 50 : 0)));
    const dynamicCharge = Math.min(-150, baseCharge - (nodeCount > 100 ? 150 : 0));
    const dynamicCollision = Math.max(40, baseCollision + (nodeCount > 100 ? 20 : 0));

    const simulation = d3Force.forceSimulation(forceNodes)
      .force('link', d3Force.forceLink(forceLinks).id(d => d.id).distance(dynamicDistance))
      .force('charge', d3Force.forceManyBody().strength(dynamicCharge))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(dynamicCollision))
      .stop();

    // 5. Run simulation synchronously in worker
    for (let i = 0; i < ticks; i++) {
      simulation.tick();
    }

    // 6. Build positions map and normalized node results
    const positions = new Map();
    const resultNodes = forceNodes.map(node => {
      const x = isNaN(node.x) || typeof node.x !== 'number' ? width / 2 : Math.round(node.x * 10) / 10;
      const y = isNaN(node.y) || typeof node.y !== 'number' ? height / 2 : Math.round(node.y * 10) / 10;
      const deg = node.degree;

      positions.set(node.id, { x, y, degree: deg });
      return {
        id: node.id,
        pos_x: x,
        pos_y: y,
        degree: deg,
        entity: node.entity
      };
    });

    return {
      nodes: resultNodes,
      positions
    };
  }
}

module.exports = GraphLayoutEngine;
