const editor = document.getElementById('editor');
const hint = document.getElementById('hint');
const toggleTopBtn = document.getElementById('toggleTop');
const clearAllBtn = document.getElementById('clearAll');

let alwaysOnTop = false;
let currentColor = '';
let lastRange = null;
let lastHue = Math.floor(Math.random() * 360);
let isComposing = false;
let compositionStartOffset = null;

function setHint(text) {
  hint.textContent = text;
}

function randomSentenceColor() {
  const hueShift = 90 + Math.floor(Math.random() * 140);
  const hue = (lastHue + hueShift) % 360;
  const saturation = 70 + Math.floor(Math.random() * 18);
  const lightness = 62 + Math.floor(Math.random() * 16);
  lastHue = hue;
  return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
}

function switchToNextColor() {
  currentColor = randomSentenceColor();
}

function isWhitespaceChar(ch) {
  return /\s/.test(ch);
}

function getNodeIndex(node) {
  if (!node || !node.parentNode) {
    return 0;
  }
  return Array.prototype.indexOf.call(node.parentNode.childNodes, node);
}

function buildEditorTextModel(root) {
  const segments = [];
  let text = '';
  let offset = 0;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || '';
      if (!value) {
        continue;
      }
      segments.push({ type: 'text', node, start: offset, end: offset + value.length });
      text += value;
      offset += value.length;
      continue;
    }

    if (node.nodeName === 'BR') {
      segments.push({ type: 'br', node, start: offset, end: offset + 1 });
      text += '\n';
      offset += 1;
    }
  }

  return { text, segments, total: offset };
}

function locateOffsetPosition(model, target, bias = 'start') {
  const { segments, total } = model;
  const safeTarget = Math.max(0, Math.min(target, total));

  if (segments.length === 0) {
    return { node: editor, offset: 0 };
  }

  if (safeTarget === total) {
    const last = segments[segments.length - 1];
    if (last.type === 'text') {
      return { node: last.node, offset: (last.node.nodeValue || '').length };
    }
    return { node: last.node.parentNode, offset: getNodeIndex(last.node) + 1 };
  }

  for (const seg of segments) {
    if (safeTarget < seg.start || safeTarget > seg.end) {
      continue;
    }

    if (seg.type === 'text') {
      return { node: seg.node, offset: safeTarget - seg.start };
    }

    if (safeTarget === seg.start || bias === 'start') {
      return { node: seg.node.parentNode, offset: getNodeIndex(seg.node) };
    }
    return { node: seg.node.parentNode, offset: getNodeIndex(seg.node) + 1 };
  }

  return { node: editor, offset: editor.childNodes.length };
}

function getCaretOffset(root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return 0;
  }

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(root);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function getCaretOffsetFromPoint(event) {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
    if (pos && pos.offsetNode) {
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      const pre = range.cloneRange();
      pre.selectNodeContents(editor);
      pre.setEnd(range.endContainer, range.endOffset);
      return pre.toString().length;
    }
  }

  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(event.clientX, event.clientY);
    if (range) {
      const pre = range.cloneRange();
      pre.selectNodeContents(editor);
      pre.setEnd(range.endContainer, range.endOffset);
      return pre.toString().length;
    }
  }

  return getCaretOffset(editor);
}

function saveCurrentRange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  lastRange = selection.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  if (lastRange) {
    selection.removeAllRanges();
    selection.addRange(lastRange);
  } else {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function insertWhitespaceAndToggleColor(whitespaceChar = ' ') {
  restoreSelection();

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const whitespaceNode = document.createTextNode(whitespaceChar);
  range.insertNode(whitespaceNode);

  range.setStartAfter(whitespaceNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  switchToNextColor();
  saveCurrentRange();
}

function insertSpaceAndToggleColor() {
  insertWhitespaceAndToggleColor(' ');
}

function insertColoredText(text) {
  if (!text) {
    return;
  }

  restoreSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const span = document.createElement('span');
  span.style.color = currentColor;
  span.textContent = text;
  range.insertNode(span);

  range.setStartAfter(span);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  saveCurrentRange();
}

function insertLineBreak() {
  restoreSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const br = document.createElement('br');
  range.insertNode(br);

  range.setStartAfter(br);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  saveCurrentRange();
}

function recolorOffsetRange(startOffset, endOffset) {
  if (endOffset <= startOffset) {
    return;
  }

  const model = buildEditorTextModel(editor);
  const startPos = locateOffsetPosition(model, startOffset, 'start');
  const endPos = locateOffsetPosition(model, endOffset, 'end');
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const text = range.toString();
  if (!text) {
    return;
  }

  range.deleteContents();
  const span = document.createElement('span');
  span.style.color = currentColor;
  span.textContent = text;
  range.insertNode(span);

  const selection = window.getSelection();
  if (selection) {
    const caretRange = document.createRange();
    caretRange.setStartAfter(span);
    caretRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caretRange);
    lastRange = caretRange.cloneRange();
  }
}

toggleTopBtn.addEventListener('click', async () => {
  alwaysOnTop = await window.desktopAPI.setAlwaysOnTop(!alwaysOnTop);
  toggleTopBtn.classList.toggle('active', alwaysOnTop);
  setHint(alwaysOnTop ? '窗口已置顶。' : '窗口已取消置顶。');
});

clearAllBtn.addEventListener('click', () => {
  editor.innerHTML = '';
  switchToNextColor();
  setHint('内容已清除。');
  editor.focus();
  saveCurrentRange();
});

editor.addEventListener('keydown', (event) => {
  if (isComposing || event.isComposing) {
    return;
  }

  saveCurrentRange();

  if (event.key === ' ') {
    event.preventDefault();
    insertSpaceAndToggleColor();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    insertLineBreak();
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    saveCurrentRange();
  }
});

editor.addEventListener('beforeinput', (event) => {
  if (isComposing || event.isComposing) {
    return;
  }

  if (
    event.inputType.startsWith('insert') &&
    typeof event.data === 'string' &&
    event.data.length > 0
  ) {
    event.preventDefault();
    if (isWhitespaceChar(event.data)) {
      insertWhitespaceAndToggleColor(event.data);
    } else {
      insertColoredText(event.data);
    }
    return;
  }

  if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
    event.preventDefault();
    insertLineBreak();
  }
});

editor.addEventListener('compositionstart', () => {
  isComposing = true;
  compositionStartOffset = getCaretOffset(editor);
});

editor.addEventListener('compositionend', () => {
  isComposing = false;
  if (compositionStartOffset !== null) {
    const compositionEndOffset = getCaretOffset(editor);
    recolorOffsetRange(compositionStartOffset, compositionEndOffset);
  }
  compositionStartOffset = null;
  saveCurrentRange();
});

editor.addEventListener('mouseup', saveCurrentRange);
editor.addEventListener('keyup', saveCurrentRange);

editor.addEventListener('dblclick', async (event) => {
  const model = buildEditorTextModel(editor);
  const text = model.text;
  if (!text.trim()) {
    return;
  }

  const caret = getCaretOffsetFromPoint(event);
  let left = caret;
  let right = caret;

  while (left > 0 && !isWhitespaceChar(text[left - 1])) {
    left -= 1;
  }
  while (right < text.length && !isWhitespaceChar(text[right])) {
    right += 1;
  }

  const selected = text.slice(left, right).trim();
  if (!selected) {
    return;
  }

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    const startPos = locateOffsetPosition(model, left, 'start');
    const endPos = locateOffsetPosition(model, right, 'end');
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    selection.removeAllRanges();
    selection.addRange(range);
    lastRange = range.cloneRange();
  }

  await window.desktopAPI.writeClipboard(selected);
  setHint(`已复制：${selected}`);
});

async function pasteFromClipboard() {
  const text = await window.desktopAPI.readClipboard();
  if (!text) {
    setHint('剪贴板为空。');
    return;
  }

  for (const ch of text) {
    if (ch === '\n') {
      insertLineBreak();
    } else if (isWhitespaceChar(ch)) {
      insertWhitespaceAndToggleColor(ch);
    } else {
      insertColoredText(ch);
    }
  }

  setHint('已粘贴剪贴板内容。');
  editor.focus();
}

editor.addEventListener('contextmenu', async (event) => {
  event.preventDefault();
  saveCurrentRange();
  await pasteFromClipboard();
});

editor.addEventListener('focus', saveCurrentRange);

switchToNextColor();
editor.focus();
setHint('准备就绪。开始写下你的第一句。');

