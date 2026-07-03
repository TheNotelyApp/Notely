# Feature Availability

This page helps you decide what works offline, what needs optional setup, and what depends on external services.

## Core Feature Matrix

| Feature | Available by default | Needs setup | Internet required |
|---|---|---|---|
| Notes create/edit | Yes | No | No |
| Folder organization | Yes | No | No |
| Edit/Split/Preview modes | Yes | No | No |
| Markdown validation | Yes | No | No |
| Typo checking | Yes | No | No |
| Global search | Yes | No | No |
| Help Center and shortcut guide | Yes | No | No |
| Recent workspaces | Yes | No | No |
| Tasks dashboard and panels | Yes | No | No |
| Version history | Yes | No | No |
| Media insert/manage | Yes | No | No |
| Embedded terminal | Yes | No | No |
| Theme, zoom, and density controls | Yes | No | No |
| Screen area capture (Windows) | Yes | No | No |
| Mermaid diagrams | Yes | No | No |
| Excalidraw diagrams | Yes | No | No |
| Workspace graph | Yes | No | No |
| Smarter graph grouping | No | Turn on AI search data | Usually yes |
| Workspace Health media checks | Yes | No | No |
| Image annotation overlays | Yes | No | No |
| Original image restore | Yes | No | No |
| PDF export | Yes | No | No |
| Workspace zip export (raw/pdf/web) | Yes | No | No |
| Workspace activity timeline | Yes | No | No |
| Website-style preview/export rendering | Yes | No | No |
| Sync with other devices | No | Pair trusted devices | Usually local network |
| AI chat | No | Sign in to an AI service | Yes |
| AI palette actions | No | Sign in to an AI service | Yes |
| Meaning-based search | No | Turn on AI search data | Yes |
| Pattern detection | No | Set up a supported AI service | Usually yes |

## Setup-Dependent Features

### P2P Sync

Requires you to connect and trust the other device first.

### AI Features

Need setup in **AI -> AI Settings** before they can work.

- AI Chat: sign in to a supported AI service
- AI palette actions: sign in to a supported AI service
- Meaning-based search: add the HuggingFace token used for smarter search
- Pattern features: use an AI service that supports them

### Semantic Graph Features

The smarter graph grouping depends on AI search data being available and up to date.

## Practical Guidance

- If you work fully offline, core note authoring features are fully available.
- If you collaborate across devices, configure P2P sync.
- If you need semantic and AI features, complete AI setup first.

In plain terms: most everyday note-writing features work without the internet. AI features need extra setup.

## Platform Notes

- Screen area capture uses Windows snip integration and is currently Windows-focused.
- Packaged release artifacts are currently prepared for Windows x64 portable builds.
