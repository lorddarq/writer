import debounce from 'lodash.debounce'
import * as state from './state'
import * as utils from './utils'

let visibleLines = new Map()
let visibleCursors = new Map()
let tokenCache = new Map()
const MAX_TOKEN_CACHE = 6000

export function reset() {
  // Remove DOM elements
  state.elements.lines.innerHTML = ''
  Array.from(visibleCursors).forEach(([, c]) => c.remove())

  // Reset local state
  visibleLines = new Map()
  visibleCursors = new Map()
  tokenCache = new Map()

  // Reset global state
  utils.setScroll(0)
}

export function draw(force) {
  drawLines(force)
  drawCursors()
  drawTextarea()
  drawScrollbar()
  drawStatus()
}

export function drawScrollbar() {
  const percentScrolled = utils.getScroll() / utils.getMaxScroll()
  state.elements.scrollbarThumb.style.height =
    utils.getScrollbarThumbLength() + 'px'
  state.elements.scrollbarThumb.style.transform = `translateY(${
    percentScrolled *
    (utils.getScrollbarTrackLength() - utils.getScrollbarThumbLength())
  }px)`
}

export function drawTextarea() {
  const { textarea } = state.elements
  const cursor = utils.getMainCursor()
  drawCursor(cursor, textarea)
}

export function drawStatus() {
  const { statusText, statusMode } = state.elements
  const cursor = utils.getMainCursor()
  if (!statusText || !cursor) {
    return
  }

  const dirty = state.editor.buffer.isDirty() ? '●' : '○'
  const fileName = state.editor.fileName || 'Untitled.txt'
  const mode = state.editor.mode || 'plain'
  const large = state.editor.largeFileMode ? '  LARGE' : ''
  const line = cursor.position.line + 1
  const column = cursor.position.column + 1
  statusText.textContent = `${dirty} ${fileName}${large}  Ln ${line}, Col ${column}`
  if (statusMode && statusMode.value !== mode) {
    statusMode.value = mode
  }
}

export function scrollMainCursorIntoView() {
  const { textarea } = state.elements
  const cursor = utils.getMainCursor()

  setTimeout(() => {
    textarea.focus()
  }, 1)

  return utils.scrollIntoViewIfNeeded(cursor.drawing.y)
}

export function drawCursors() {
  const hideEditorCursor =
    state.editor.find.visible &&
    document.activeElement === state.elements.findInput

  // No cursors drawn yet, mount them
  if (!visibleCursors.size) {
    state.editor.cursors.map((c) => {
      const el = cursor()
      state.elements.wrapper.appendChild(el)
      visibleCursors.set(c.id, el)
    })
  }

  if (hideEditorCursor) {
    state.editor.cursors.map((c) => {
      const el = visibleCursors.get(c.id)
      if (el) {
        el.style.opacity = '0'
      }
    })
    return
  }

  state.editor.cursors.map((c) => {
    const el = visibleCursors.get(c.id)
    if (el) {
      el.style.opacity = '1'
      drawCursor(c, el)
    }
  })
}

function drawCursor(cursor, el) {
  el.style.transform = `translate(${cursor.drawing.x}px, ${cursor.drawing.y}px)`
}

export function drawLines(force = true) {
  const first = utils.getTopScreenLine()
  const last = utils.getBottomScreenLine()
  const cursor = utils.getMainCursor()
  const [currentScreenLine] = state.editor.buffer.bufferToScreen(
    cursor.position.line,
    cursor.position.column
  )
  const bracketHighlights = getBracketHighlights()

  const height = Math.max(
    utils.getEditorHeight(),
    state.editor.buffer.screenLength * state.settings.text.lineHeight
  )

  state.elements.lines.style.height = height + 'px'

  // No lines rendered yet, render all visible ones
  if (!visibleLines.size) {
    for (let i = first; i <= last; i++) {
      const l = line(i)
      l.classList.toggle('writer-line-current', i === currentScreenLine)
      state.elements.lines.appendChild(l)
      visibleLines.set(i, l)
    }
    return
  }

  // Add any newly visible lines
  for (let i = first; i <= last; i++) {
    if (visibleLines.has(i)) {
      if (force) {
        const el = visibleLines.get(i)
        el.style.top = utils.getLineTop(i) + 'px'
        setLineContent(
          el,
          state.editor.buffer.getScreenLineContent(i),
          bracketHighlights.get(i)
        )
        el.classList.toggle('writer-line-current', i === currentScreenLine)
      }
      continue
    }

    const l = line(i)
    setLineContent(
      l,
      state.editor.buffer.getScreenLineContent(i),
      bracketHighlights.get(i)
    )
    l.classList.toggle('writer-line-current', i === currentScreenLine)
    state.elements.lines.appendChild(l)
    visibleLines.set(i, l)
  }

  // Remove any lines that are no longer visible
  for (let [index, item] of visibleLines.entries()) {
    if (index < first || index > last) {
      visibleLines.delete(index)
      item.remove()
    }
  }
}

export function editor() {
  const editor = document.createElement('div')
  editor.setAttribute('writer-editor', '')
  updateStyles(editor)
  return editor
}

export function textarea() {
  const textarea = document.createElement('textarea')
  textarea.setAttribute('writer-textarea', '')
  textarea.setAttribute('autocomplete', 'off')
  textarea.setAttribute('autocapitalize', 'off')
  textarea.setAttribute('autocorrect', 'off')
  textarea.setAttribute('spellcheck', 'false')
  textarea.setAttribute('tab-index', '0')
  return textarea
}

export function lines() {
  const lines = document.createElement('div')
  lines.setAttribute('writer-lines', '')
  return lines
}

export function line(screenIndex) {
  const line = document.createElement('div')
  line.setAttribute('writer-line', '')
  line.style.top = utils.getLineTop(screenIndex) + 'px'
  setLineContent(line, state.editor.buffer.getScreenLineContent(screenIndex))
  return line
}

export function decorations() {
  const decorations = document.createElement('div')
  decorations.setAttribute('writer-decorations', '')
  return decorations
}

export function decoration(screenIndex) {
  const decoration = document.createElement('div')
  decoration.setAttribute('writer-decoration', '')
  decoration.style.top = utils.getLineTop(screenIndex) + 'px'
  return decoration
}

export function cursor() {
  const cursor = document.createElement('div')
  cursor.setAttribute('writer-cursor', '')
  return cursor
}

export function scrollbar() {
  const scrollbar = document.createElement('div')
  scrollbar.setAttribute('writer-scrollbar', '')

  const thumb = document.createElement('div')
  thumb.setAttribute('writer-scrollbar-thumb', '')
  scrollbar.appendChild(thumb)

  return [scrollbar, thumb]
}

export function status() {
  const root = document.createElement('div')
  root.setAttribute('writer-status', '')

  const text = document.createElement('div')
  text.setAttribute('writer-status-text', '')

  const mode = document.createElement('select')
  mode.setAttribute('writer-status-mode', '')
  const modes = [
    'plain',
    'javascript',
    'typescript',
    'json',
    'markdown',
    'python',
    'go',
    'rust',
  ]
  modes.forEach((value) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    mode.appendChild(option)
  })

  root.appendChild(text)
  root.appendChild(mode)

  return [root, text, mode]
}

export function find() {
  const bar = document.createElement('div')
  bar.setAttribute('writer-find', '')

  const input = document.createElement('input')
  input.setAttribute('writer-find-input', '')
  input.setAttribute('type', 'text')
  input.setAttribute('placeholder', 'Find')
  input.setAttribute('aria-label', 'Find')

  const count = document.createElement('div')
  count.setAttribute('writer-find-count', '')
  count.textContent = '0/0'

  bar.appendChild(input)
  bar.appendChild(count)

  return [bar, input, count]
}

export function wrapper() {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('writer-wrapper', '')
  return wrapper
}

export function updateStyles(el) {
  const style = el?.style || state.elements.editor.style
  const codeMode = isCodeMode(state.editor.mode)
  const fontFamily = codeMode
    ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
    : state.settings.text.font

  // Text styles
  style.setProperty('--text-line-height', state.settings.text.lineHeight + 'px')
  style.setProperty('--text-color', state.settings.text.color)
  style.setProperty('--text-font-family', fontFamily)

  // Selection styles
  style.setProperty('--selection-color', state.settings.selection.color)

  // Cursor styles
  style.setProperty('--cursor-width', state.settings.cursor.width + 'px')
  style.setProperty('--cursor-radius', state.settings.cursor.radius + 'px')
  style.setProperty('--cursor-color', state.settings.cursor.color)
  style.setProperty(
    '--cursor-animation-duration',
    state.settings.cursor.animation.duration + 'ms'
  )

  // Scrollbar styles
  style.setProperty('--scrollbar-width', state.settings.scrollbar.width + 'px')
  style.setProperty('--scrollbar-gap', state.settings.scrollbar.gap + 'px')
  style.setProperty('--scrollbar-color', state.settings.scrollbar.color)
  style.setProperty(
    '--scrollbar-active-color',
    state.settings.scrollbar.activeColor
  )
  style.setProperty(
    '--scrollbar-minHeight',
    state.settings.scrollbar.minHeight + 'px'
  )
  style.setProperty(
    '--scrollbar-animation-duration',
    state.settings.scrollbar.animation.duration + 'ms'
  )
}

function isCodeMode(mode) {
  return [
    'javascript',
    'typescript',
    'json',
    'python',
    'go',
    'rust',
  ].includes(mode)
}

export function wrapVisibleLines() {
  const first = utils.getTopScreenLine()
  const last = utils.getBottomScreenLine()

  for (let i = first; i <= last; i++) {
    state.editor.buffer.wrapScreenLine(i)
  }
}

function setLineContent(el, text, bracketColumns) {
  const query = state.editor.largeFileMode ? '' : state.editor.find.query
  const mode = state.editor.largeFileMode ? 'plain' : state.editor.mode
  const tokens = getCachedTokens(text, mode)
  const fragment = document.createDocumentFragment()

  for (const token of tokens) {
    appendToken(fragment, token.text, token.type, query)
  }

  el.replaceChildren(fragment)
  if (bracketColumns?.size) {
    applyCharHighlights(el, bracketColumns)
  }
}

function getCachedTokens(text, mode) {
  const key = mode + '\u0000' + text
  const cached = tokenCache.get(key)
  if (cached) {
    return cached
  }

  const tokens = tokenizeLine(text, mode)
  tokenCache.set(key, tokens)

  if (tokenCache.size > MAX_TOKEN_CACHE) {
    const first = tokenCache.keys().next().value
    tokenCache.delete(first)
  }

  return tokens
}

function appendToken(fragment, text, type, query) {
  if (!text) {
    return
  }

  const container =
    type === 'plain'
      ? document.createDocumentFragment()
      : tokenElement(type)

  if (!query) {
    container.appendChild(document.createTextNode(text))
  } else {
    const lowerText = text.toLocaleLowerCase()
    const lowerQuery = query.toLocaleLowerCase()
    let start = 0
    let next = lowerText.indexOf(lowerQuery)

    while (next !== -1) {
      if (next > start) {
        container.appendChild(document.createTextNode(text.slice(start, next)))
      }

      const mark = document.createElement('span')
      mark.setAttribute('writer-find-match', '')
      mark.textContent = text.slice(next, next + query.length)
      container.appendChild(mark)
      start = next + query.length
      next = lowerText.indexOf(lowerQuery, start)
    }

    if (start < text.length) {
      container.appendChild(document.createTextNode(text.slice(start)))
    }
  }

  fragment.appendChild(container)
}

function tokenElement(type) {
  const el = document.createElement('span')
  el.className = `writer-token-${type}`
  return el
}

function tokenizeLine(text, mode) {
  if (!text) {
    return [{ text: '', type: 'plain' }]
  }

  if (mode === 'javascript' || mode === 'typescript') {
    return tokenizeByRegex(
      text,
      /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|new|try|catch|throw|async|await)\b|\b\d+(?:\.\d+)?\b)/g,
      (value) => {
        if (value.startsWith('//')) return 'comment'
        if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`'))
          return 'string'
        if (/^\d/.test(value)) return 'number'
        return 'keyword'
      }
    )
  }

  if (mode === 'json') {
    return tokenizeByRegex(
      text,
      /("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\]:,])/g,
      (value) => {
        if (value.startsWith('"')) return 'string'
        if (/^[{}\[\]:,]$/.test(value)) return 'punct'
        if (/^(true|false|null)$/.test(value)) return 'keyword'
        return 'number'
      }
    )
  }

  if (mode === 'markdown') {
    if (/^\s*```/.test(text)) {
      return [{ text, type: 'code' }]
    }
    if (/^\s*#{1,6}\s/.test(text)) {
      return [{ text, type: 'heading' }]
    }

    return tokenizeByRegex(
      text,
      /(`[^`]+`)|(\*\*[^*]+\*\*|\*[^*]+\*)/g,
      (value) => (value.startsWith('`') ? 'code' : 'emphasis')
    )
  }

  return [{ text, type: 'plain' }]
}

function tokenizeByRegex(text, regex, classify) {
  const tokens = []
  let last = 0
  regex.lastIndex = 0
  let match

  while ((match = regex.exec(text))) {
    const index = match.index
    if (index > last) {
      tokens.push({ text: text.slice(last, index), type: 'plain' })
    }

    const value = match[0]
    tokens.push({ text: value, type: classify(value) })
    last = index + value.length
  }

  if (last < text.length) {
    tokens.push({ text: text.slice(last), type: 'plain' })
  }

  return tokens
}

function getBracketHighlights() {
  const highlights = new Map()
  if (state.editor.largeFileMode) {
    return highlights
  }

  const cursor = utils.getMainCursor()
  if (!cursor) {
    return highlights
  }

  const buffer = state.editor.buffer
  const line = cursor.position.line
  const text = buffer.getLineContent(line) || ''
  if (!text) {
    return highlights
  }

  const point = getBracketPairInLine(text, cursor.position.column)
  if (!point) {
    return highlights
  }

  const [a, b] = point
  addBracketHighlight(highlights, buffer, line, a)
  addBracketHighlight(highlights, buffer, line, b)
  return highlights
}

function getBracketPairInLine(text, cursorColumn) {
  const leftColumn = cursorColumn - 1
  const leftChar = text[leftColumn]
  const rightChar = text[cursorColumn]

  const candidates = [
    [cursorColumn, rightChar],
    [leftColumn, leftChar],
  ]

  for (const [column, char] of candidates) {
    if (char == null || column < 0) {
      continue
    }

    const match = findMatchingBracket(text, column, char)
    if (match != null) {
      return [column, match]
    }
  }

  return null
}

function findMatchingBracket(text, index, char) {
  const pairs = { '(': ')', '[': ']', '{': '}' }
  const reversePairs = { ')': '(', ']': '[', '}': '{' }

  if (pairs[char]) {
    const close = pairs[char]
    let depth = 1
    for (let i = index + 1; i < text.length; i++) {
      if (text[i] === char) depth++
      else if (text[i] === close) depth--
      if (depth === 0) return i
    }
    return null
  }

  if (reversePairs[char]) {
    const open = reversePairs[char]
    let depth = 1
    for (let i = index - 1; i >= 0; i--) {
      if (text[i] === char) depth++
      else if (text[i] === open) depth--
      if (depth === 0) return i
    }
  }

  return null
}

function addBracketHighlight(map, buffer, line, column) {
  const [screenLine, screenColumn] = buffer.bufferToScreen(line, column)
  const set = map.get(screenLine) || new Set()
  set.add(screenColumn)
  map.set(screenLine, set)
}

function applyCharHighlights(el, columns) {
  const sorted = [...columns].sort((a, b) => b - a)
  for (const column of sorted) {
    highlightColumn(el, column)
  }
}

function highlightColumn(el, column) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node
  let offset = column

  while ((node = walker.nextNode())) {
    const text = node.nodeValue || ''
    if (offset < text.length) {
      wrapTextOffset(node, offset)
      return
    }
    offset -= text.length
  }
}

function wrapTextOffset(textNode, offset) {
  const text = textNode.nodeValue || ''
  const char = text[offset]
  if (!char) {
    return
  }

  const mark = document.createElement('span')
  mark.className = 'writer-bracket-match'
  mark.textContent = char

  if (text.length === 1) {
    textNode.parentNode.replaceChild(mark, textNode)
    return
  }

  const fragment = document.createDocumentFragment()
  if (offset > 0) {
    fragment.appendChild(document.createTextNode(text.slice(0, offset)))
  }
  fragment.appendChild(mark)
  if (offset + 1 < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(offset + 1)))
  }

  textNode.parentNode.replaceChild(fragment, textNode)
}

let oldWidth

export function resize() {
  const height = state.elements.editor.parentElement.offsetHeight
  const width = utils.getEditorWidth()
  state.elements.editor.style.height = height + 'px'
  state.elements.lines.style.width = width + 'px'

  if (oldWidth !== undefined && oldWidth !== width) {
    wrapVisibleLines()
    rewrap()
  }

  draw(true)
  oldWidth = width
}

const rewrap = debounce(() => {
  state.editor.buffer.wrapAllLineBuffers()
}, 400)

let scrollTimer

export function showScrollbar() {
  clearTimeout(scrollTimer)
  state.elements.scrollbarThumb.style.opacity = '1'
}

export function hideScrollbar() {
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    state.elements.scrollbarThumb.style.opacity = '0'
  }, state.settings.scrollbar.animation.delay)
}

export function wheel(e) {
  if (utils.setScroll(state.editor.scroll + e.deltaY)) {
    draw()
    showScrollbar()
    hideScrollbar() // queue the hiding
  }
}
