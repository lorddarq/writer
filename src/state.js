import { proxy } from 'valtio/vanilla'

export const editor = {
  drawing: { scroll: 0, scrollbar: { opacity: 0 } },
  scroll: 0,
  rolloverScroll: 0,
  fileName: 'Untitled.txt',
  mode: 'plain',
  largeFileMode: false,
  find: {
    visible: false,
    query: '',
    matches: [],
    activeIndex: -1,
  },
  /** @type {import('./cursor').default[]} */
  cursors: [],
  /** @type {import('./buffer').default} */
  buffer: null,
  /** @type {CanvasRenderingContext2D} */
  ctx: null,

  /** @type {{ detail: number }} */
  moveContext: {},

  scrollbarContext: {},
}

export const elements = {
  editor: null,
  lines: null,
  decorations: null,
  textarea: null,
  status: null,
  statusText: null,
  statusMode: null,
  find: null,
  findInput: null,
  findCount: null,
  scrollbar: null,
  scrollbarThumb: null,
  dumpButton: null,
}

export const settings = proxy({
  text: {
    color: '#e5e5e5',
    lineHeight: 28,
    fontSize: 16,
    font: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  cursor: {
    width: 4,
    color: '#838383',
    radius: 2,
    animation: {
      duration: 80,
    },
  },
  scroll: {
    animation: {
      duration: 80,
    },
  },
  scrollbar: {
    width: 8,
    gap: 5,
    minHeight: 32,
    color: 'rgba(127, 127, 127, 0.5)',
    activeColor: 'rgba(200, 200, 200, 0.5)',
    animation: {
      delay: 800,
      duration: 200,
    },
  },
  selection: {
    color: '#444',
  },
  wrapping: {
    /** @type {'break-all' | 'break-word' | 'measure'} */
    algorithm: 'measure',
  },
})
