---
title: Feature Availability Matrix
description: View offline compatibility and network requirements for Notely features.
keywords: internet required, offline support, offline setup, capabilities
category: Reference
---

# Feature Availability

The matrix below details which features run entirely offline, which require local network settings, and which require internet access.

<FeatureMatrix :features="[
  { feature: 'Notes Create/Edit', available: true, setup: 'No', internet: false },
  { feature: 'Folder Organization', available: true, setup: 'No', internet: false },
  { feature: 'Edit/Split/Preview Modes', available: true, setup: 'No', internet: false },
  { feature: 'Markdown Validation', available: true, setup: 'No', internet: false },
  { feature: 'Typo Checking', available: true, setup: 'No', internet: false },
  { feature: 'Global Search', available: true, setup: 'No', internet: false },
  { feature: 'Help Center', available: true, setup: 'No', internet: false },
  { feature: 'Tasks Dashboard', available: true, setup: 'No', internet: false },
  { feature: 'Version History (Git)', available: true, setup: 'No', internet: false },
  { feature: 'Media Library & Disk Scanner', available: true, setup: 'No', internet: false },
  { feature: 'Embedded Terminal', available: true, setup: 'No', internet: false },
  { feature: 'Screen Capture & Snipping', available: true, setup: 'No', internet: false },
  { feature: 'Screen Video Recording & Overlay', available: true, setup: 'No', internet: false },
  { feature: 'Dual-Stream Audio & Meeting Recording', available: true, setup: 'No', internet: false },
  { feature: 'Local Speech-to-Text (ONNX Whisper)', available: true, setup: 'Download Model (~40-460MB)', internet: false },
  { feature: 'Cloud Speech-to-Text (Groq / OpenAI)', available: false, setup: 'Configure API Key in AI Settings', internet: true },
  { feature: 'Model Context Protocol (MCP) Server', available: true, setup: 'No (Runs on port 3700)', internet: false },
  { feature: 'Mermaid Diagrams', available: true, setup: 'No', internet: false },
  { feature: 'Excalidraw Diagrams', available: true, setup: 'No', internet: false },
  { feature: 'Workspace Graph & Neural Extraction', available: true, setup: 'No (Local GLiNER2 ONNX)', internet: false },
  { feature: 'Semantic Hybrid Search (BGE)', available: true, setup: 'No (Local BGE ONNX)', internet: false },
  { feature: 'Workspace Sync (Git Remotes)', available: true, setup: 'Configure Remote URL', internet: 'Remote host' }
]" />
