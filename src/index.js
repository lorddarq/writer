import Buffer from './buffer'
import Cursor from './cursor'
import { Point } from './position'
import * as measure from './measure'
import * as state from './state'
import * as drawing from './drawing'
import * as utils from './utils'

const initialText = `Hey, welcome to writer.\n`
const SESSION_KEY = 'writer.session.v1'
const LARGE_FILE_LINE_LIMIT = 50000

const modeByExtension = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  json: 'json',
  md: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
}

function paste(e) {
  e.preventDefault()
  const content = e.clipboardData.getData('text/plain')
  utils.insertText(content)
  refreshFindIfNeeded()
  drawing.scrollMainCursorIntoView()
  drawing.draw()
  scheduleSessionSave()
}

function input(e) {
  const content = e.target.value
  e.target.value = ''
  utils.insertText(content)
  refreshFindIfNeeded()
  drawing.scrollMainCursorIntoView()
  drawing.draw()
  scheduleSessionSave()
}

function keyDown(e) {
  let handled = true

  switch (e.key) {
    case 'Enter': {
      utils.newline(state.editor.mode)
      break
    }
    case 'Tab': {
      utils.tab(e.shiftKey)
      break
    }
    case 'Backspace': {
      if (e.metaKey) {
        utils.deleteToStartOfLine()
      } else if (e.altKey) {
        utils.deleteToStartOfWord()
      } else {
        utils.backspace()
      }
      break
    }
    case 'ArrowUp': {
      if (e.metaKey) {
        utils.moveToTop(e.shiftKey)
      } else if (e.altKey && !e.shiftKey) {
        utils.swapLine(-1)
      } else {
        utils.moveUp(1, e.shiftKey)
      }
      break
    }
    case 'ArrowDown': {
      if (e.metaKey) {
        utils.moveToBottom(e.shiftKey)
      } else if (e.altKey && !e.shiftKey) {
        utils.swapLine(1)
      } else {
        utils.moveDown(1, e.shiftKey)
      }
      break
    }
    case 'ArrowRight': {
      if (e.metaKey) {
        utils.moveToEndOfLine(e.shiftKey)
      } else if (e.altKey) {
        utils.moveToEndOfWord(e.shiftKey)
      } else {
        utils.moveRight(1, e.shiftKey)
      }
      break
    }
    case 'ArrowLeft': {
      if (e.metaKey) {
        utils.moveToStartOfLine(e.shiftKey)
      } else if (e.altKey) {
        utils.moveToStartOfWord(e.shiftKey)
      } else {
        utils.moveLeft(1, e.shiftKey)
      }
      break
    }
    case 'a': {
      if (e.metaKey || e.ctrlKey) {
        utils.selectAll()
      } else {
        handled = false
      }
      break
    }
    case 'c': {
      if (e.metaKey || e.ctrlKey) {
        utils.copy()
      } else {
        handled = false
      }
      break
    }
    case 'x': {
      if (e.metaKey || e.ctrlKey) {
        utils.cut()
      } else {
        handled = false
      }
      break
    }
    default: {
      handled = false
    }
  }

  if (handled) {
    e.preventDefault()
    refreshFindIfNeeded()
    drawing.scrollMainCursorIntoView()
    drawing.draw()
    scheduleSessionSave()
  }
}

function scrollbarMove(e) {
  const maxScroll = utils.getMaxScroll()
  const trackLength = utils.getScrollbarTrackLength()
  const thumbLength = utils.getScrollbarThumbLength()
  const ratio = maxScroll / (trackLength - thumbLength)
  const deltaY = e.pageY - state.editor.scrollbarContext.initialY

  const newScroll = utils.getScroll() + ratio * deltaY
  state.editor.scrollbarContext.initialY = e.pageY
  utils.setScroll(newScroll)
  drawing.draw()
}

function scrollbarUp() {
  window.removeEventListener('mousemove', scrollbarMove)
  window.removeEventListener('mouseup', this)
  state.editor.scrollbarContext = {}
  drawing.hideScrollbar()
}

function scrollbarDown(e) {
  e.preventDefault()
  state.editor.scrollbarContext.initialY = e.pageY
  state.elements.scrollbarThumb.style.opacity = '1'
  window.addEventListener('mousemove', scrollbarMove)
  window.addEventListener('mouseup', scrollbarUp)
}

function scrollbarEnter() {
  if (state.elements.scrollbarThumb.style.opacity !== '0') {
    drawing.showScrollbar()
  }
}

function scrollbarLeave() {
  if (!state.editor.scrollbarContext.initialY) {
    drawing.hideScrollbar()
  }
}

function selectionMove(e) {
  const { cursors, moveContext, buffer } = state.editor
  const line = utils.yToLine(e.pageY)
  const screenPoint =
    line > utils.getLastScreenLineNumber()
      ? utils.getLastScreenLineLastColumn()
      : new Point(line, utils.xToColumn(e.pageX, line))

  const [bl, bc] = buffer.screenToBuffer(screenPoint.line, screenPoint.column)
  const point = new Point(bl, bc)

  const cursor = cursors[0]

  if (!cursor.selection.focus.equals(point)) {
    if (moveContext?.detail === 2) {
      cursor.selection.focus = point
      if (cursor.selection.direction === 'backward') {
        if (!moveContext?.reversed) {
          cursor.moveToEndOfWord()
          moveContext.reversed = true
        }
        cursor.moveToStartOfWord(true)
      } else {
        cursor.moveToEndOfWord(true)
      }
    } else if (moveContext?.detail === 3) {
      cursor.selection.focus = point
      if (cursor.selection.direction === 'backward') {
        if (!moveContext?.reversed) {
          cursor.moveToEndOfParagraph()
          moveContext.reversed = true
        }
        cursor.moveToStartOfParagraph(true)
      } else {
        cursor.moveToEndOfParagraph(true)
      }
    } else {
      cursor.moveTo(point.line, point.column, true)
    }
  }

  drawing.scrollMainCursorIntoView()
  drawing.drawCursors()
}

function selectionUp() {
  window.removeEventListener('mousemove', selectionMove)
  window.removeEventListener('mouseup', this)
  state.editor.moveContext = {}
}

function selectionDown(e) {
  const { cursors, moveContext, buffer } = state.editor
  const line = utils.yToLine(e.pageY)
  const screenPoint =
    line > utils.getLastScreenLineNumber()
      ? utils.getLastScreenLineLastColumn()
      : new Point(line, utils.xToColumn(e.pageX, line))

  const [bl, bc] = buffer.screenToBuffer(screenPoint.line, screenPoint.column)
  const point = new Point(bl, bc)

  if (e.altKey) {
    const cursor = new Cursor()
    cursor.moveToPoint(point)
    cursors.push(cursor)
  } else {
    utils.flattenToOneCursor()
    if (e.shiftKey) {
      cursors[0].moveToPoint(point, true)
    } else {
      cursors[0].moveToPoint(point)
    }

    moveContext.detail = e.detail
    if (e.detail === 2) {
      cursors[0].selectWord()
    } else if (e.detail === 3) {
      cursors[0].selectParagraph()
    }
  }

  window.addEventListener('mousemove', selectionMove)
  window.addEventListener('mouseup', selectionUp)
  drawing.scrollMainCursorIntoView()
  drawing.draw()
}

function dragEnter(e) {
  e.stopPropagation()
  e.preventDefault()
  document.body.style.border = '2px solid red'
}

function dragOver(e) {
  e.stopPropagation()
  e.preventDefault()
}

function dragLeave(e) {
  e.stopPropagation()
  e.preventDefault()
  document.body.style.border = null
}

async function drop(e) {
  e.stopPropagation()
  e.preventDefault()
  document.body.style.border = null

  const dropped = e.dataTransfer.files[0]
  if (!dropped) return

  drawing.reset()
  state.editor.cursors = [new Cursor()]

  const buffer = await Buffer.loadBrowserFile(dropped, measure.getLineBreak)
  buffer.wrapAllLineBuffersSync()
  buffer.resetHistory()

  state.editor.fileName = dropped.name
  state.editor.mode = detectMode(dropped.name, getBufferSample(buffer))
  updateLargeFileMode(buffer)
  state.editor.buffer = buffer

  refreshFindIfNeeded()
  drawing.drawScrollbar()
  drawing.draw()
  scheduleSessionSave()
}

async function init(rootElement) {
  const { elements, editor } = state

  elements.editor = drawing.editor()
  elements.textarea = drawing.textarea()
  elements.lines = drawing.lines()
  elements.decorations = drawing.decorations()
  const [status, statusText, statusMode] = drawing.status()
  elements.status = status
  elements.statusText = statusText
  elements.statusMode = statusMode
  const [find, findInput, findCount] = drawing.find()
  elements.find = find
  elements.findInput = findInput
  elements.findCount = findCount
  elements.find.dataset.visible = 'false'
  elements.wrapper = drawing.wrapper()
  const [scrollbar, thumb] = drawing.scrollbar()
  elements.scrollbar = scrollbar
  elements.scrollbarThumb = thumb

  elements.wrapper.appendChild(elements.textarea)
  elements.wrapper.appendChild(elements.decorations)
  elements.wrapper.appendChild(elements.lines)
  elements.editor.appendChild(elements.wrapper)
  elements.editor.appendChild(elements.scrollbar)
  elements.editor.appendChild(elements.status)
  elements.editor.appendChild(elements.find)
  rootElement.appendChild(elements.editor)

  window.addEventListener('resize', drawing.resize)
  window.addEventListener('keydown', globalShortcuts, { capture: true })
  window.addEventListener('beforeunload', persistSession)
  document.body.addEventListener('dragenter', dragEnter)
  document.body.addEventListener('dragover', dragOver)
  document.body.addEventListener('dragleave', dragLeave)
  document.body.addEventListener('drop', drop)
  elements.editor.addEventListener('mousedown', () =>
    setTimeout(() => elements.textarea.focus(), 1)
  )
  elements.editor.addEventListener('wheel', drawing.wheel)
  elements.lines.addEventListener('mousedown', selectionDown)
  elements.textarea.addEventListener('input', input)
  elements.textarea.addEventListener('paste', paste)
  elements.textarea.addEventListener('keydown', keyDown)
  elements.findInput.addEventListener('input', (e) => setFindQuery(e.target.value))
  elements.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) findPrevious()
      else findNext()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeFind()
    }
  })
  elements.statusMode.addEventListener('change', (e) => {
    state.editor.mode = e.target.value
    drawing.draw(true)
    scheduleSessionSave()
  })
  elements.scrollbarThumb.addEventListener('mousedown', scrollbarDown)
  elements.scrollbar.addEventListener('mouseenter', scrollbarEnter)
  elements.scrollbar.addEventListener('mouseleave', scrollbarLeave)

  const restored = restoreSession()
  const buffer = new Buffer(measure.getLineBreak)
  buffer.loadText(restored?.text ?? initialText)
  buffer.wrapAllLineBuffersSync()
  buffer.resetHistory()

  editor.buffer = buffer
  editor.cursors = [new Cursor()]
  editor.fileName = restored?.fileName || editor.fileName
  editor.mode =
    restored?.mode || detectMode(editor.fileName, getBufferSample(buffer))
  updateLargeFileMode(buffer)
  if (typeof restored?.scroll === 'number') {
    editor.scroll = restored.scroll
  }
  if (restored?.cursor && Number.isFinite(restored.cursor.line)) {
    const cursor = editor.cursors[0]
    cursor.moveTo(restored.cursor.line, restored.cursor.column || 0)
  }

  elements.lines.style.height =
    buffer.screenLength * state.settings.text.lineHeight + 'px'
  updateFindCount()
  drawing.resize()
  if (typeof restored?.scroll === 'number') {
    utils.setScroll(restored.scroll)
    drawing.draw()
  }
}

init(document.querySelector('main'))

function saveDocument() {
  const { buffer, fileName } = state.editor
  const text = buffer.toString()
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'Untitled.txt'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  buffer.markSaved()
  drawing.drawStatus()
  scheduleSessionSave()
}

function openFind() {
  state.editor.find.visible = true
  state.elements.find.dataset.visible = 'true'
  state.elements.findInput.focus()
  state.elements.findInput.select()
}

function closeFind() {
  state.editor.find.visible = false
  state.elements.find.dataset.visible = 'false'
  state.editor.find.query = ''
  state.editor.find.matches = []
  state.editor.find.activeIndex = -1
  state.elements.findInput.value = ''
  updateFindCount()
  drawing.draw(true)
  state.elements.textarea.focus()
  scheduleSessionSave()
}

function setFindQuery(query) {
  state.editor.find.query = query
  recomputeFindMatches()

  if (state.editor.find.matches.length === 0) {
    state.editor.find.activeIndex = -1
  } else if (
    state.editor.find.activeIndex >= state.editor.find.matches.length ||
    state.editor.find.activeIndex < 0
  ) {
    state.editor.find.activeIndex = 0
  }

  updateFindCount()
  drawing.draw(true)
  scheduleSessionSave()
}

function refreshFindIfNeeded() {
  if (!state.editor.find.query) return

  recomputeFindMatches()
  if (state.editor.find.matches.length === 0) {
    state.editor.find.activeIndex = -1
  } else if (state.editor.find.activeIndex >= state.editor.find.matches.length) {
    state.editor.find.activeIndex = state.editor.find.matches.length - 1
  }
  updateFindCount()
}

function recomputeFindMatches() {
  const query = state.editor.find.query
  if (!query || state.editor.largeFileMode) {
    state.editor.find.matches = []
    return
  }

  const matches = []
  const needle = query.toLocaleLowerCase()
  const { buffer } = state.editor

  for (let line = 0; line < buffer.length; line++) {
    const haystack = (buffer.getLineContent(line) || '').toLocaleLowerCase()
    let from = 0
    let index = haystack.indexOf(needle, from)

    while (index !== -1) {
      matches.push({ line, column: index, length: query.length })
      from = index + query.length
      index = haystack.indexOf(needle, from)
    }
  }

  state.editor.find.matches = matches
}

function findNext() {
  const { matches, activeIndex } = state.editor.find
  if (!matches.length) return
  jumpToMatch((activeIndex + 1) % matches.length)
}

function findPrevious() {
  const { matches, activeIndex } = state.editor.find
  if (!matches.length) return
  jumpToMatch((activeIndex - 1 + matches.length) % matches.length)
}

function jumpToMatch(index) {
  const match = state.editor.find.matches[index]
  if (!match) return

  utils.flattenToOneCursor()
  const cursor = state.editor.cursors[0]
  cursor.moveTo(match.line, match.column)
  state.editor.find.activeIndex = index
  updateFindCount()
  drawing.scrollMainCursorIntoView()
  drawing.draw(true)
}

function globalShortcuts(e) {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return

  const key = e.key.toLowerCase()
  const inFindInput = e.target === state.elements.findInput
  const inEditorInput = e.target === state.elements.textarea
  const inEditableInput =
    e.target instanceof HTMLElement &&
    (e.target.isContentEditable ||
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA')

  if (key === 'f') {
    e.preventDefault()
    e.stopPropagation()
    openFind()
    return
  }

  if (key === 'g') {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) findPrevious()
    else findNext()
    return
  }

  if (key === 's') {
    e.preventDefault()
    e.stopPropagation()
    saveDocument()
    return
  }

  if (inEditableInput && !inEditorInput && !inFindInput) {
    return
  }

  if (key === 'z') {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      if (utils.redo()) {
        refreshFindIfNeeded()
        drawing.scrollMainCursorIntoView()
        drawing.draw()
        scheduleSessionSave()
      }
    } else if (utils.undo()) {
      refreshFindIfNeeded()
      drawing.scrollMainCursorIntoView()
      drawing.draw()
      scheduleSessionSave()
    }
    return
  }

  if (key === 'a') {
    e.preventDefault()
    e.stopPropagation()
    utils.selectAll()
    drawing.scrollMainCursorIntoView()
    drawing.draw()
    scheduleSessionSave()
  }
}

function updateFindCount() {
  if (state.editor.largeFileMode && state.editor.find.query) {
    state.elements.findCount.textContent = 'LARGE'
    return
  }

  const { activeIndex, matches } = state.editor.find
  const active = matches.length ? activeIndex + 1 : 0
  state.elements.findCount.textContent = `${active}/${matches.length}`
}

function getBufferSample(buffer, maxLines = 200) {
  const lines = []
  const limit = Math.min(buffer.length, maxLines)
  for (let i = 0; i < limit; i++) {
    lines.push(buffer.getLineContent(i) || '')
  }
  return lines.join('\n')
}

function detectMode(fileName = '', textSample = '') {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension && modeByExtension[extension]) {
    return modeByExtension[extension]
  }

  const firstLine = textSample.split('\n', 1)[0]
  if (firstLine?.startsWith('#!')) {
    const lower = firstLine.toLowerCase()
    if (lower.includes('python')) return 'python'
    if (lower.includes('node')) return 'javascript'
    if (lower.includes('deno')) return 'typescript'
  }

  const scores = {
    javascript: scorePatterns(textSample, [
      /\b(function|const|let|var|import|export|return|await)\b/g,
      /=>/g,
      /[{};]/g,
    ]),
    json: scorePatterns(textSample, [
      /"[^"]+"\s*:/g,
      /[{}\[\],]/g,
      /\b(true|false|null)\b/g,
    ]),
    markdown: scorePatterns(textSample, [
      /^\s*#{1,6}\s/mg,
      /^\s*[-*+]\s/mg,
      /```/g,
    ]),
    python: scorePatterns(textSample, [
      /\b(def|class|import|from|return)\b/g,
      /:\s*(#.*)?$/gm,
      /^\s{4,}\S/mg,
    ]),
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (!ranked.length || ranked[0][1] < 3) {
    return 'plain'
  }

  if (ranked[0][0] === 'json' && !looksLikeJson(textSample)) {
    const fallback = ranked.find(([mode, score]) => mode !== 'json' && score >= 3)
    return fallback ? fallback[0] : 'plain'
  }

  return ranked[0][0]
}

function scorePatterns(text, patterns) {
  let score = 0
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    score += matches?.length || 0
  }
  return score
}

function looksLikeJson(text) {
  const trimmed = text.trim()
  if (!trimmed) {
    return false
  }

  if (
    !(
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    )
  ) {
    return false
  }

  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

function updateLargeFileMode(buffer) {
  state.editor.largeFileMode = buffer.length > LARGE_FILE_LINE_LIMIT
}

let sessionSaveTimer

function scheduleSessionSave() {
  clearTimeout(sessionSaveTimer)
  sessionSaveTimer = setTimeout(persistSession, 120)
}

function persistSession() {
  try {
    const cursor = state.editor.cursors[0]
    const payload = {
      text: state.editor.buffer?.toString() || '',
      fileName: state.editor.fileName,
      mode: state.editor.mode,
      scroll: utils.getScroll(),
      cursor: cursor
        ? { line: cursor.position.line, column: cursor.position.column }
        : { line: 0, column: 0 },
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // Ignore persistence errors (quota/privacy mode)
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.text !== 'string') return null
    return parsed
  } catch {
    return null
  }
}
