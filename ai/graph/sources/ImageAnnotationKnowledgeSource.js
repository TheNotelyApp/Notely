/**
 * ImageAnnotationKnowledgeSource - Extracts entities and relationships from user image annotations
 */

const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');

class ImageAnnotationKnowledgeSource extends KnowledgeSource {
  constructor(annotationMap = new Map()) {
    super();
    this.annotationMap = annotationMap || new Map();
  }

  sourceType() {
    return 'image_annotation';
  }

  baseConfidence() {
    return 0.95;
  }

  discover() {
    return Array.from(this.annotationMap.keys()).filter(imgPath => {
      const entry = this.annotationMap.get(imgPath);
      return entry && entry.text && entry.text.trim().length > 0;
    });
  }

  async extractEntities(imagePath) {
    const entry = this.annotationMap.get(imagePath);
    if (!entry || !entry.text) return [];

    const imageName = path.basename(imagePath);
    const entities = [
      {
        name: imageName,
        type: 'Image',
        properties: { path: imagePath, annotation: entry.text }
      }
    ];

    const terms = entry.text.split(/[,;\n]+/).map(t => t.trim()).filter(t => t.length > 2);
    for (const term of terms) {
      entities.push({
        name: term,
        type: 'Concept',
        properties: { extractedFromAnnotation: true }
      });
    }

    return entities;
  }

  async extractRelationships(imagePath) {
    const entry = this.annotationMap.get(imagePath);
    if (!entry || !entry.text) return [];

    const imageName = path.basename(imagePath);
    const relationships = [];
    const terms = entry.text.split(/[,;\n]+/).map(t => t.trim()).filter(t => t.length > 2);

    for (const term of terms) {
      relationships.push({
        source_name: imageName,
        target_name: term,
        source_type: 'Image',
        target_type: 'Concept',
        type: 'annotated_with',
        weight: 0.95,
        confidence: 0.95
      });
    }

    return relationships;
  }
}

module.exports = ImageAnnotationKnowledgeSource;
