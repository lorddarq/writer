# Writer Usability Plan (Minimalist Vision)

## Philosophy and Constraints

Writer should stay fast, focused, and distraction-free.

Principles:
- Keep the UI mostly text-first; avoid heavy chrome.
- Add features only when they improve editing flow for most users.
- Favor progressive disclosure: simple by default, more power on demand.
- Preserve performance as a product feature, especially on large files.
- Keep implementation complexity proportional to user value.

Non-goals:
- Full IDE behavior.
- Plugin marketplace.
- Highly configurable, panel-heavy interface.

---

## Product Direction

Primary goal:
- Make plain text editing excellent, then add lightweight code awareness.

Secondary goal:
- Introduce syntax and language detection without changing the minimalist character.

UX baseline target:
- A new user can open, edit, search, and save text in under 30 seconds with no tutorial.

---

## Roadmap Overview

Progress snapshot (March 4, 2026):
- [x] Reliable undo/redo history (transaction-based)
- [x] History bounds (entry cap)
- [x] Save flow (`Cmd+S`) with export fallback
- [x] Unsaved indicator + minimalist status strip
- [x] Status strip line/column + filename + mode display
- [x] Search experience (`Cmd+F`) baseline (inline bar, count, next/previous, viewport highlighting)
- [x] Language detection baseline (extension + shebang + content scoring heuristic)
- [x] Manual mode override (status strip mode picker)
- [x] Syntax highlighting baseline by mode (`js/ts`, `json`, `markdown`)
- [x] Auto-indent + tab/shift-tab indentation basics
- [~] Quiet visual guidance (current-line highlight implemented; bracket matching pending)
- [x] Session restore baseline (local content + cursor + scroll + mode)
- [~] Large-file safety baseline (automatic simplified rendering mode)
- [~] Tokenization optimization baseline (token cache; worker path pending)
- [x] Bracket matching baseline (near-cursor pair highlight)

## Phase 1: Editing Fundamentals (High Impact, Low Visual Noise)

### 1) Reliable undo/redo history
- Implement `undo`/`redo` in `Buffer` (currently hotkeys call missing methods).
- Use grouped transactions (typing bursts, paste, delete word, line move).
- Keep history bounded (e.g., memory cap + operation cap).
Status: [x] Implemented (with entry bounds)

Minimalist guardrail:
- No timeline UI. Keyboard-first only.

### 2) Search experience (`Cmd+F`)
- Add inline find bar with:
  - query input
  - next/previous match
  - match count
- Highlight matches in visible viewport only; lazy-highlight offscreen.

Minimalist guardrail:
- Hide find bar until invoked. No persistent sidebar.
Status: [x] Baseline implemented (inline bar, match count, next/prev, highlight)

### 3) Save flow + unsaved state
- Implement `Cmd+S` behavior:
  - If opened via dropped file: use File System Access API when available.
  - Fallback to download export.
- Show subtle unsaved indicator in status strip.
Status: [x] Implemented (download export + dirty state + status strip)

Minimalist guardrail:
- Single-line status strip; no modal-heavy workflow.

---

## Phase 2: Minimal Code Awareness

### 4) Document mode system
- Add `document.mode`:
  - `plain`, `javascript`, `typescript`, `json`, `markdown`, `python`, `go`, `rust`, etc.
- Display current mode in status strip.
- Allow manual override via compact mode picker.
Status: [x] Implemented (status display + compact manual override picker)

Minimalist guardrail:
- Default remains `plain` and auto-detection is quiet.

### 5) Language detection (lightweight heuristic)
- Detection order:
  1. filename extension (highest confidence)
  2. shebang line
  3. content scoring (keyword/operator density + structure markers)
- If confidence < threshold, keep `plain`.

Candidate scoring signals:
- JS/TS: `function`, `const`, `=>`, `{}`, `import`, `export`
- Python: `def`, `class`, `:`, indentation patterns
- JSON: braces + quoted keys + commas + colon ratio
- Markdown: heading markers, list markers, code fences

Minimalist guardrail:
- Never show warning popups for uncertain detection.
Status: [x] Implemented (extension, shebang, and lightweight content scoring)

### 6) Syntax highlighting architecture (virtualization-compatible)
- Keep rendering by visible lines.
- Add token cache by buffer line:
  - `lineNumber -> tokenSpans[]`
- Invalidate only edited lines and nearby affected lines.
- Render line content as token spans, not raw `innerText`.

Implementation approach:
- Start with small tokenizers per mode (regex/state-machine).
- Defer parser-grade engines (Tree-sitter/Lezer) unless needed.

Minimalist guardrail:
- Use restrained color palette and low-contrast accents.
Status: [~] Baseline implemented (line-level token coloring + token cache); no worker yet

---

## Phase 3: Quiet Visual Guidance

### 7) Selection + caret clarity
- Proper selection painting using existing decorations layer.
- Optional current-line highlight (very subtle).
- Matching bracket highlight only when cursor is near bracket.

Minimalist guardrail:
- No animated effects unless they clarify state.
Status: [x] Baseline implemented (current-line + near-cursor bracket pair highlight)

### 8) Gutter essentials
- Add optional line numbers (off by default or auto-on for code modes).
- Keep gutter narrow and low-contrast.

Minimalist guardrail:
- No breakpoint/debug gutters.

### 9) Indentation and structure helpers
- Auto-indent on Enter in code modes.
- Tab / Shift+Tab indent-outdent for selected lines.
- Optional indent guides with subdued styling.

Minimalist guardrail:
- No intrusive lint squiggles in editor surface.
Status: [~] Partially implemented (auto-indent on Enter + tab/shift-tab basics)

---

## Phase 4: Power Features Without Bloat

### 10) Multi-cursor completion
- Keep alt-click multi-cursor.
- Ensure edit operations apply consistently across cursors.
- Merge overlapping cursors predictably.

### 11) Command shortcuts and discoverability
- Add shortcut overlay (`Cmd+/`) with essential actions only.
- Keep a single compact list; no searchable command palette yet.

### 12) Session restore
- Restore recent content/cursor/scroll/mode for unsaved work.
- Include privacy-safe behavior (explicit opt-in or local-only note).

Minimalist guardrail:
- No cloud sync in first iteration.
Status: [x] Baseline implemented (local restore of content, mode, cursor, scroll)

---

## Phase 5: Performance and Large-File Safety

### 13) Large-file mode
- Trigger thresholds based on lines/size.
- Auto-disable expensive features:
  - full-document highlight
  - broad match decoration
- Keep core editing responsive.
Status: [~] Baseline implemented (line-threshold based simplified rendering)

### 14) Background tokenization
- Move tokenization to a Web Worker when file size crosses threshold.
- Apply partial updates progressively to visible region first.

Minimalist guardrail:
- Prefer temporary reduced fidelity over stutter.
Status: [ ] Not started

---

## UX Surface Proposal (Minimal UI Additions)

Keep only two persistent surfaces:
- Editor canvas (existing)
- Bottom status strip (new, one line)

Status strip fields:
- mode
- file name
- unsaved marker
- line:column
- optional transient messages (saved, detection updated)

Ephemeral surfaces:
- find bar (invoked)
- shortcut overlay (invoked)
- mode picker (invoked)

---

## Suggested Technical Work Breakdown

1. History engine in `buffer.js` + operation wrappers in `utils.js`.
2. Status strip and mode state in `state.js` + `drawing.js`.
3. Find model + visible match decorations.
4. Mode detection service (filename + heuristic).
5. Token pipeline for visible lines; integrate with virtual draw.
6. Auto-indent and tab indentation mechanics.
7. Session restore and save flow hardening.
8. Worker tokenization and large-file degradation rules.

---

## Quality Gates and Success Metrics

Functional gates:
- No regression in core typing/navigation behavior.
- Undo/redo correctness across insert/delete/newline/paste.
- Mode detection can be overridden manually anytime.

Performance gates:
- Scrolling remains smooth on files >= 50k lines.
- No blocking highlight work on main thread for large files.
- Initial open time remains competitive with current behavior.

Usability gates:
- Find flow requires <= 3 interactions for next match.
- Save state is always visible but unobtrusive.
- Code highlighting improves scanability without visual clutter.

---

## Prioritized Backlog (If building incrementally)

1. Worker-based background tokenization.
2. Large-file advanced degradation rules.

---

## Final Position

The project can evolve into a code-aware editor without losing minimalism if:
- defaults stay quiet,
- controls stay keyboard-first,
- visuals stay restrained,
- and performance remains a hard constraint.
