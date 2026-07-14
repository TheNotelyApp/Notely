---
title: Code Blocks
description: Auto-detect languages, auto-format with Prettier, and edit code in a dedicated popup — all from inside Notely.
keywords: code block, syntax highlighting, auto-format, prettier, code editor, language detection
category: Editor
---

# Code Blocks

Notely provides a rich experience for working with code inside Markdown notes: automatic language detection, one-click formatting with Prettier, and a dedicated full-screen code editor.

## Insert a Code Block

In Edit mode, use the toolbar **Code** button or type three backticks followed by a language name:

````markdown
```python
def hello(name):
    return f"Hello, {name}!"
```
````

Notely renders the block with syntax highlighting in Preview and Split modes.

## Auto-Detect Language

If you paste a code snippet without a language tag, Notely attempts to detect the language automatically:

1. Paste code into an empty fenced block (` ``` ` without a language).
2. Notely inspects the content and adds the correct language tag.
3. The block re-renders with appropriate highlighting.

Supported auto-detected languages include JavaScript, TypeScript, Python, HTML, CSS, JSON, YAML, Bash, SQL, Go, Rust, and more.

## Auto-Format with Prettier

In **Preview** mode, a toolbar appears on hover above each code block. Click the **🪄 Format** button to auto-format the code using Prettier:

- Applies consistent indentation
- Normalizes quotes and semicolons
- Respects the language-appropriate style

The formatting is written back to the Markdown source automatically.

You can also trigger formatting from inside the dedicated code editor.

## Dedicated Code Editor

For a distraction-free editing experience:

1. Switch to **Preview** mode.
2. Hover over any code block — a toolbar appears.
3. Click the **✎ Edit** button.

The dedicated code editor opens with:

- **Syntax highlighting** for the block's language
- **Find and Replace** (`Ctrl + F`)
- **Language selector** — switch the code language
- **Line numbers**
- **Format button** — run Prettier from within the editor

Click **Save** to write changes back to the note, or **Cancel** to discard.

## Code Execution

You can run code snippets directly from your notes:

1. Hover over a code block in **Preview** mode.
2. If the block is written in JavaScript (`js`, `javascript`) or Python (`py`, `python`), the **▶ Run** button in the hover toolbar will be active.
3. Click **▶ Run** to execute the script locally.
4. The output is displayed in a collapsible, high-contrast dark terminal output frame beneath the code block.

You can also execute code from inside the **Dedicated Code Editor** modal using the **Execute** button in the top toolbar.

::: warning Security Note
Running code execution spawns a local process on your machine using your local `node` or `python`/`python3` installation. Only run code from trusted workspaces and sources.
:::

::: info Execution Limits & Loops
Code execution terminates automatically after 10 seconds. If your code hangs or enters an infinite loop, the runner will kill the subprocess safely and report a timeout error.
:::

## Supported Languages

Notely supports highlighting for all [highlight.js](https://highlightjs.org/) languages, including:

| Category | Examples |
|---|---|
| Web | `html`, `css`, `javascript`, `typescript`, `jsx`, `tsx` |
| Backend | `python`, `go`, `rust`, `java`, `csharp`, `php`, `ruby` |
| Data | `json`, `yaml`, `toml`, `xml`, `sql` |
| Shell | `bash`, `powershell`, `cmd` |
| Markup | `markdown`, `latex` |
| Config | `nginx`, `dockerfile`, `makefile` |

## Tips

::: tip Copy Button
Every code block in Preview mode has a **Copy** button in the top-right corner. Click it to copy the code contents without the backtick fences.
:::

::: tip Language Tags are Important
Always specify a language tag for better highlighting and to ensure the auto-formatter chooses the right rules. Example: ` ```typescript ` instead of ` ``` `.
:::
