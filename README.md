# writer

Plain text editor from scratch, made for the web. Drag and drop files to open them.

## Language & Technology Stack

**Language:** JavaScript (ES Modules)

**Core Dependencies:**
- [Valtio](https://valtio.dev) - Reactive state management using JavaScript proxies
- [Vite](https://vitejs.dev) - Lightning-fast build tool for development and production
- [tinykeys](https://github.com/jamiebuilds/tinykeys) - Tiny keyboard shortcuts library
- [@rkusa/linebreak](https://github.com/rkusa/js-linebreak) - Advanced Unicode-aware line-breaking algorithm
- lodash.debounce - Debouncing utility for performance optimization

## Architecture

- Buffer is an array of array of lines
- Text is manually measured and wrapped with canvas
- Lines are virtualized on scroll and drawn as divs
- Cursor and selection are also divs
- Word boundary operations are emulated with textarea
- Styling through CSS variables

## Design Patterns

### State Management (Valtio)
The application uses reactive state management with Valtio proxies for seamless reactivity:
- `editor` - Main editor state (scroll position, cursors, buffer, canvas context)
- `elements` - DOM element references for direct manipulation
- `settings` - Configuration for text rendering, cursor appearance, scrollbar behavior, and wrapping algorithm

Changes to these proxies automatically trigger re-renders without explicit subscriptions.

### Virtual Rendering
Only visible lines are mounted to the DOM to optimize performance with large files:
- Lines outside the viewport are removed
- A `visibleLines` Map tracks currently rendered content
- Lines are added/removed as the user scrolls
- Significant performance improvement for files with thousands of lines

### Event-Driven Architecture
The application responds to keyboard, mouse, and paste events:
- Keyboard events handle text input, navigation, and editing operations
- Mouse events manage scrolling and selection interactions
- Paste events handle clipboard operations
- All events trigger a `draw()` cycle to update the UI

## Interaction Model

### Text Editing
- **Character input** - Direct keyboard input inserts text at cursor position
- **Newline** - Enter key creates a new line
- **Deletion** - Backspace removes characters, with modifiers for word/line deletion
  - `Backspace` - Delete previous character
  - `Cmd + Backspace` - Delete to start of line
  - `Alt + Backspace` - Delete to start of word

### Navigation & Selection
- **Arrow keys** - Move cursor in all directions
- **Cmd + Arrow** - Jump to line/document boundaries
- **Alt + Arrow** - Move to word boundaries
- **Shift + Any movement** - Extend selection while moving
- **Cmd + A** - Select all text

### Line Operations
- **Alt + Up/Down** - Swap line with adjacent line (move line up/down)

### Clipboard Operations
- **Cmd + C** - Copy selected text
- **Cmd + V** - Paste from clipboard
- **Cmd + X** - Cut selected text

### Scrolling & UI
- **Mouse wheel** - Smooth scroll with momentum via virtual rendering
- **Scrollbar interaction** - Direct scrollbar manipulation
- **Cursor visibility** - Auto-scroll to keep cursor in view

### Multi-Cursor Support
The architecture supports multiple cursors (future enhancement):
- Each cursor maintains its own position and visual representation
- Cursors are rendered as DOM divs with animation
- Keyboard operations can be extended to multiple cursors

### Text Measurement & Wrapping
- Text is measured using canvas rendering context
- Configurable wrapping algorithm:
  - `measure` - Intelligent word wrapping based on viewport width
  - `break-word` - Break at any character
  - `break-all` - CSS-style breaking
- Unicode-aware line breaking with @rkusa/linebreak

## Performance Features

- **Debouncing** - Input and scroll events are debounced to reduce redraws
- **Virtual Scrolling** - Only visible lines exist in DOM
- **Canvas Measurement** - Efficient text layout calculation
- **GPU-friendly Rendering** - CSS transforms and opacity animations
- **Lazy Element Creation** - Events and cursors created on demand

### Future

- B-tree buffer with height map
- History system
- Operational transform
- Alternate canvas renderer with FreeType and Harfbuzz
