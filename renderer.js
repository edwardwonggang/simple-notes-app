const dom = {
  workspace: document.querySelector('.workspace'),
  inlinePrompt: document.getElementById('inlinePrompt'),
  themeToggle: document.getElementById('themeToggle'),
  backgroundToggle: document.getElementById('backgroundToggle'),
  backgroundPanel: document.getElementById('backgroundPanel'),
  settingsToggle: document.getElementById('settingsToggle'),
  settingsModal: document.getElementById('settingsModal'),
  settingsClose: document.getElementById('settingsClose'),
  profilesList: document.getElementById('profilesList'),
  addProfileButton: document.getElementById('addProfileButton'),
  deleteProfileButton: document.getElementById('deleteProfileButton'),
  profileFormTitle: document.getElementById('profileFormTitle'),
  profileNameInput: document.getElementById('profileName'),
  apiUrlInput: document.getElementById('apiUrl'),
  apiKeyInput: document.getElementById('apiKey'),
  toggleApiKeyVisibilityButton: document.getElementById('toggleApiKeyVisibility'),
  modelInput: document.getElementById('model'),
  modelOptionsInput: document.getElementById('modelOptions'),
  proxyInput: document.getElementById('proxyUrl'),
  tlsInput: document.getElementById('ignoreTlsErrors'),
  systemPromptInput: document.getElementById('systemPrompt'),
  temperatureInput: document.getElementById('temperature'),
  maxTokensInput: document.getElementById('maxTokens'),
  saveSettingsButton: document.getElementById('saveSettings'),
  configPath: document.getElementById('configPath'),
  documentView: document.getElementById('documentView'),
  documentsList: document.getElementById('documentsList'),
  documentsPath: document.getElementById('documentsPath'),
  newDocumentButton: document.getElementById('newDocumentButton'),
  promptInput: document.getElementById('promptInput'),
  inlineModelPicker: document.getElementById('inlineModelPicker'),
  inlineModelTrigger: document.getElementById('inlineModelTrigger'),
  inlineModelLabel: document.getElementById('inlineModelLabel'),
  inlineModelPanel: document.getElementById('inlineModelPanel'),
  inlineModelList: document.getElementById('inlineModelList'),
  diagramPreviewModal: document.getElementById('diagramPreviewModal'),
  diagramPreviewContent: document.getElementById('diagramPreviewContent'),
  diagramPreviewClose: document.getElementById('diagramPreviewClose'),
  promptStatusLabel: document.getElementById('promptStatusLabel'),
  actionButton: document.getElementById('actionButton'),
  clearButton: document.getElementById('clearButton'),
  statusText: document.getElementById('statusText')
};

const THEME_KEY = 'ai_markdown_client_theme';
const EDITOR_BG_KEY = 'ai_markdown_client_editor_bg';
const PROMPT_PLACEHOLDER = '向 AI 提问，Enter 发送，Ctrl + Enter 换行';
const AUTOSAVE_DELAY = 700;
const EDITOR_BACKGROUNDS = ['default', 'eye-care', 'paper'];

const state = {
  configStore: null,
  activeProfileId: '',
  selectedModelProfileId: '',
  selectedModelName: '',
  messages: [],
  currentRequestId: '',
  isGenerating: false,
  currentAnswerHost: null,
  currentAnswerRaw: '',
  promptAnchorRange: null,
  documents: [],
  documentsPath: '',
  activeDocumentId: '',
  saveTimer: null,
  diagramRenderTimer: null,
  isSaving: false,
  pendingResave: false,
  isDirty: false
};

const markdown = window.markdownit({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true
});
const defaultFenceRenderer = markdown.renderer.rules.fence
  ? markdown.renderer.rules.fence.bind(markdown.renderer.rules)
  : null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeRichHtml(value) {
  if (!window.DOMPurify) {
    return String(value || '');
  }

  return window.DOMPurify.sanitize(String(value || ''), {
    USE_PROFILES: {
      html: true,
      svg: true,
      svgFilters: true
    },
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: [
      'class',
      'style',
      'hidden',
      'role',
      'aria-hidden',
      'aria-label',
      'aria-expanded',
      'focusable',
      'viewBox',
      'preserveAspectRatio',
      'zoomAndPan',
      'contentStyleType',
      'contentScriptType',
      'data-diagram-type'
    ]
  });
}

function createDiagramBlockMarkup(type, source) {
  return [
    `<div class="diagram-block" data-diagram-type="${escapeHtml(type)}" contenteditable="false">`,
    `<pre class="diagram-source" hidden>${escapeHtml(source)}</pre>`,
    '<button class="diagram-expand-button" type="button" title="最大化查看" aria-label="最大化查看图形">',
    '<span aria-hidden="true">',
    '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">',
    '<path d="M8 4.75H4.75V8M15.999 4.75h3.25V8M8 19.25H4.75V16M19.249 16v3.25h-3.25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>',
    '</span>',
    '</button>',
    '<div class="diagram-render">',
    `<div class="diagram-placeholder">${type.toUpperCase()} 渲染中...</div>`,
    '</div>',
    '</div>'
  ].join('');
}

function createHighlightedCodeBlockMarkup(source, language = '') {
  const codeHtml = window.aiClient?.highlightCode
    ? window.aiClient.highlightCode(source, language)
    : escapeHtml(source);

  return [
    `<pre class="code-block ${language ? `language-${escapeHtml(language)}` : ''}">`,
    `<code class="hljs ${language ? `language-${escapeHtml(language)}` : ''}">${codeHtml}</code>`,
    '</pre>'
  ].join('');
}

function createHtmlPreviewBlockMarkup(source, language = 'html') {
  return [
    `<div class="html-preview-block" data-renderable-type="html" data-renderable-language="${escapeHtml(language)}" contenteditable="false">`,
    `<pre class="html-preview-source" hidden>${escapeHtml(source)}</pre>`,
    '<div class="html-preview-render"></div>',
    createHighlightedCodeBlockMarkup(source, language),
    '</div>'
  ].join('');
}

markdown.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const language = String(token.info || '').trim().split(/\s+/)[0].toLowerCase();

  if (language === 'mermaid') {
    return createDiagramBlockMarkup('mermaid', token.content);
  }

  if (['plantuml', 'puml', 'uml'].includes(language)) {
    return createDiagramBlockMarkup('plantuml', token.content);
  }

  if (language === 'svg') {
    return createDiagramBlockMarkup('svg', token.content);
  }

  if (['html', 'htm'].includes(language)) {
    return createHtmlPreviewBlockMarkup(token.content, language || 'html');
  }

  return createHighlightedCodeBlockMarkup(token.content, language);
};

function setStatus(text, tone = 'normal') {
  dom.statusText.hidden = !text;
  dom.statusText.textContent = text || '';
  dom.statusText.dataset.tone = tone;
}

function loadTheme() {
  const savedTheme = window.localStorage.getItem(THEME_KEY);
  return savedTheme === 'dark' ? 'dark' : 'light';
}

function loadEditorBackground() {
  const savedBackground = window.localStorage.getItem(EDITOR_BG_KEY);
  return EDITOR_BACKGROUNDS.includes(savedBackground) ? savedBackground : 'default';
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const isDark = theme === 'dark';
  dom.themeToggle.title = isDark ? '切换浅色' : '切换深色';
  dom.themeToggle.setAttribute('aria-label', isDark ? '切换浅色' : '切换深色');
  dom.themeToggle.classList.toggle('is-active', isDark);
  scheduleDiagramRender(dom.documentView, 0);
}

function applyEditorBackground(background) {
  const nextBackground = EDITOR_BACKGROUNDS.includes(background) ? background : 'default';
  document.body.dataset.editorBg = nextBackground;
  syncEditorBackgroundOptions(nextBackground);
}

function syncEditorBackgroundOptions(activeBackground = loadEditorBackground()) {
  const options = dom.backgroundPanel?.querySelectorAll('[data-editor-bg]');
  if (!options) {
    return;
  }

  options.forEach((button) => {
    const isActive = button.dataset.editorBg === activeBackground;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  window.localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

function isBackgroundPanelOpen() {
  return Boolean(dom.backgroundPanel) && !dom.backgroundPanel.hidden;
}

function openBackgroundPanel() {
  if (!dom.backgroundPanel) {
    return;
  }
  dom.backgroundPanel.hidden = false;
  dom.backgroundToggle?.setAttribute('aria-expanded', 'true');
  syncEditorBackgroundOptions(document.body.dataset.editorBg || loadEditorBackground());
}

function closeBackgroundPanel() {
  if (!dom.backgroundPanel) {
    return;
  }
  dom.backgroundPanel.hidden = true;
  dom.backgroundToggle?.setAttribute('aria-expanded', 'false');
}

function toggleBackgroundPanel() {
  if (isBackgroundPanelOpen()) {
    closeBackgroundPanel();
    return;
  }
  openBackgroundPanel();
}

function setEditorBackground(background) {
  window.localStorage.setItem(EDITOR_BG_KEY, background);
  applyEditorBackground(background);
  closeBackgroundPanel();
}

function getMermaidTheme() {
  return document.body.dataset.theme === 'dark' ? 'dark' : 'default';
}

function ensureMermaidInitialized() {
  if (!window.mermaid) {
    return false;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: getMermaidTheme()
  });
  return true;
}

function sanitizeSvgMarkup(source) {
  const parser = new DOMParser();
  const documentSvg = parser.parseFromString(String(source || '').trim(), 'image/svg+xml');
  const root = documentSvg.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    throw new Error('SVG 内容无效');
  }

  if (documentSvg.querySelector('parsererror')) {
    throw new Error('SVG 解析失败');
  }

  root.querySelectorAll('script').forEach((node) => node.remove());
  root.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return root.outerHTML;
}

async function renderPlantUmlSvg(source) {
  return sanitizeSvgMarkup(await window.aiClient.renderPlantUml(source));
}

function escapeStyleTagContent(value) {
  return String(value || '').replace(/<\/style/gi, '<\\/style');
}

function buildHtmlPreviewDocument(source) {
  const parser = new DOMParser();
  const htmlDocument = parser.parseFromString(String(source || ''), 'text/html');
  const inlineStyles = Array.from(htmlDocument.querySelectorAll('style'))
    .map((styleNode) => escapeStyleTagContent(styleNode.textContent || ''))
    .filter(Boolean)
    .join('\n');
  const bodyMarkup = sanitizeRichHtml(htmlDocument.body?.innerHTML || '');
  const fallbackMarkup = sanitizeRichHtml(source);
  const contentMarkup = bodyMarkup.trim() ? bodyMarkup : fallbackMarkup;

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<style>',
    ':root { color-scheme: light; }',
    'html, body { margin: 0; padding: 0; min-height: 0 !important; height: auto !important; background: #ffffff !important; color: #0f172a; font-family: "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif; }',
    'body { line-height: 1.6; }',
    '#htmlPreviewRoot { padding: 16px; background: #ffffff; color: #0f172a; }',
    'table { width: 100%; border-collapse: collapse; border-spacing: 0; background: #ffffff; }',
    'th, td { border: 1px solid #dbe2ea; padding: 8px 10px; text-align: left; vertical-align: top; }',
    'th { background: #f8fafc; }',
    'img, svg, canvas, video { max-width: 100%; height: auto; }',
    'pre { white-space: pre-wrap; word-break: break-word; }',
    '</style>',
    inlineStyles ? `<style>${inlineStyles}</style>` : '',
    '<style>html, body { min-height: 0 !important; height: auto !important; background: #ffffff !important; } body { padding: 0 !important; } #htmlPreviewRoot { background: #ffffff !important; }</style>',
    '</head>',
    '<body>',
    `<div id="htmlPreviewRoot">${contentMarkup || '<div></div>'}</div>`,
    '</body>',
    '</html>'
  ].join('');
}

function transformLegacyRenderableBlocks(container = dom.documentView) {
  const scope = container || dom.documentView;
  const codeBlocks = Array.from(scope.querySelectorAll('pre > code')).filter((code) => {
    const pre = code.parentElement;
    return pre && !pre.closest('.diagram-block, .html-preview-block');
  });

  codeBlocks.forEach((code) => {
    const pre = code.parentElement;
    const source = code.textContent || '';
    const languageClass = Array.from(code.classList).find((name) => name.startsWith('language-')) || '';
    const language = languageClass.replace(/^language-/, '').toLowerCase();
    const inferredType = ['mermaid', 'plantuml', 'puml', 'uml', 'svg'].includes(language)
      ? language
      : (/^\s*@startuml\b/i.test(source) ? 'plantuml' : '');
    const inferredRenderable = inferredType || (['html', 'htm'].includes(language) ? 'html' : '');

    if (!pre || !inferredRenderable) {
      return;
    }

    const wrapper = document.createElement('div');
    if (inferredRenderable === 'html') {
      wrapper.innerHTML = createHtmlPreviewBlockMarkup(source, language || 'html');
    } else {
      const nextType = inferredRenderable === 'puml' || inferredRenderable === 'uml'
        ? 'plantuml'
        : inferredRenderable;
      wrapper.innerHTML = createDiagramBlockMarkup(nextType, source);
    }
    const nextBlock = wrapper.firstElementChild;
    if (nextBlock) {
      nextBlock.setAttribute('contenteditable', 'false');
      pre.replaceWith(nextBlock);
    }
  });
}

function resizeHtmlPreviewFrame(frame) {
  if (!frame) {
    return;
  }

  const frameDocument = frame.contentDocument;
  if (!frameDocument?.documentElement) {
    return;
  }

  const contentRoot = frameDocument.getElementById('htmlPreviewRoot');
  const nextHeight = Math.max(
    contentRoot?.scrollHeight || 0,
    frameDocument.body?.scrollHeight || 0,
    frameDocument.documentElement.scrollHeight || 0,
    140
  );

  frame.style.height = `${Math.min(nextHeight + 2, 960)}px`;
}

function renderHtmlPreviewBlocks(container = dom.documentView) {
  const scope = container || dom.documentView;
  const blocks = Array.from(scope.querySelectorAll('.html-preview-block'));

  blocks.forEach((block) => {
    block.setAttribute('contenteditable', 'false');
    const source = block.querySelector('.html-preview-source')?.textContent || '';
    const host = block.querySelector('.html-preview-render');
    if (!host) {
      return;
    }

    host.innerHTML = '';

    if (!source.trim()) {
      host.innerHTML = '<div class="html-preview-empty">HTML 预览为空</div>';
      block.classList.remove('is-rendered');
      return;
    }

    const frame = document.createElement('iframe');
    frame.className = 'html-preview-frame';
    frame.title = 'HTML 渲染预览';
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.srcdoc = buildHtmlPreviewDocument(source);
    frame.addEventListener('load', () => {
      resizeHtmlPreviewFrame(frame);
      window.setTimeout(() => resizeHtmlPreviewFrame(frame), 32);
    });

    host.appendChild(frame);
    block.classList.add('is-rendered');
  });
}

function isDiagramPreviewOpen() {
  return Boolean(dom.diagramPreviewModal) && !dom.diagramPreviewModal.hidden;
}

function closeDiagramPreview() {
  if (!dom.diagramPreviewModal || !dom.diagramPreviewContent) {
    return;
  }

  dom.diagramPreviewModal.hidden = true;
  dom.diagramPreviewContent.innerHTML = '';
}

function openDiagramPreview(block) {
  if (!block || !dom.diagramPreviewModal || !dom.diagramPreviewContent) {
    return;
  }

  const render = block.querySelector('.diagram-render');
  if (!render || !render.querySelector('svg')) {
    return;
  }

  dom.diagramPreviewContent.innerHTML = render.innerHTML;
  dom.diagramPreviewModal.hidden = false;
}

async function renderDiagramBlock(block, index = 0) {
  if (!block) {
    return;
  }

  const source = block.querySelector('.diagram-source')?.textContent || '';
  const host = block.querySelector('.diagram-render');
  const type = String(block.dataset.diagramType || '').toLowerCase();
  if (!source.trim() || !host) {
    return;
  }

  try {
    if (type === 'svg') {
      host.innerHTML = sanitizeSvgMarkup(source);
      block.classList.add('is-rendered');
      return;
    }

    if (type === 'plantuml') {
      host.innerHTML = await renderPlantUmlSvg(source);
      block.classList.add('is-rendered');
      return;
    }

    if (type === 'mermaid') {
      if (!ensureMermaidInitialized()) {
        throw new Error('Mermaid 未加载');
      }

      const renderId = `mermaid-${Date.now()}-${index}`;
      const { svg } = await window.mermaid.render(renderId, source);
      host.innerHTML = svg;
      block.classList.add('is-rendered');
      return;
    }

    host.innerHTML = `<pre><code>${escapeHtml(source)}</code></pre>`;
    block.classList.add('is-rendered');
  } catch (error) {
    host.innerHTML = `<div class="diagram-error">${escapeHtml(error.message || '图形渲染失败')}</div>`;
    block.classList.remove('is-rendered');
  }
}

function scheduleDiagramRender(container = dom.documentView, delay = 180) {
  if (state.diagramRenderTimer) {
    clearTimeout(state.diagramRenderTimer);
  }

  state.diagramRenderTimer = window.setTimeout(() => {
    state.diagramRenderTimer = null;
    transformLegacyRenderableBlocks(container);
    renderHtmlPreviewBlocks(container);
    const blocks = Array.from((container || dom.documentView)?.querySelectorAll('.diagram-block') || []);
    blocks.forEach((block, index) => {
      void renderDiagramBlock(block, index);
    });
  }, delay);
}

function syncPromptHeight() {
  const input = dom.promptInput;
  if (!input) {
    return;
  }
  input.style.height = '0px';
  const nextHeight = Math.max(60, Math.min(input.scrollHeight, 220));
  input.style.height = `${nextHeight}px`;
}

function isInlinePromptVisible() {
  return !dom.inlinePrompt.hidden;
}

function openSettingsModal() {
  dom.settingsModal.hidden = false;
  renderProfilesList();
  fillProfileForm(getActiveProfile());
}

function closeSettingsModal() {
  dom.settingsModal.hidden = true;
  setApiKeyVisibility(false);
}

function createProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseModelOptions(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/\n|,/);
  const seen = new Set();
  return source
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

function normalizeProfileDraft(input = {}) {
  const modelOptions = parseModelOptions(input.modelOptions ?? input.models ?? []);
  let model = String(input.model ?? '').trim();
  if (!model && modelOptions.length) {
    model = modelOptions[0];
  } else if (model && !modelOptions.includes(model)) {
    modelOptions.unshift(model);
  }

  return {
    id: String(input.id || '').trim() || createProfileId(),
    name: String(input.name || '').trim() || '未命名配置',
    apiUrl: String(input.apiUrl || '').trim(),
    apiKey: String(input.apiKey || '').trim(),
    model,
    modelOptions,
    proxyUrl: String(input.proxyUrl || '').trim(),
    ignoreTlsErrors: Boolean(input.ignoreTlsErrors),
    systemPrompt: String(input.systemPrompt || ''),
    temperature: Number(input.temperature),
    maxTokens: Number(input.maxTokens)
  };
}

function getProfiles() {
  return Array.isArray(state.configStore?.profiles) ? state.configStore.profiles : [];
}

function getActiveProfile() {
  const profiles = getProfiles();
  return profiles.find((profile) => profile.id === state.activeProfileId) || profiles[0] || null;
}

function getProfileModels(profile) {
  const models = parseModelOptions(profile?.modelOptions ?? []);
  if (models.length) {
    return models;
  }

  const fallbackModel = String(profile?.model || '').trim();
  return fallbackModel ? [fallbackModel] : [];
}

function getAllModelEntries() {
  return getProfiles().flatMap((profile) => {
    const profileName = String(profile?.name || '').trim() || '未命名提供商';
    return getProfileModels(profile).map((model) => ({
      key: `${profile.id}::${model}`,
      profileId: profile.id,
      profileName,
      model
    }));
  });
}

function setSelectedModel(profileId = '', model = '') {
  state.selectedModelProfileId = String(profileId || '').trim();
  state.selectedModelName = String(model || '').trim();
}

function getSelectedModelEntry(entries = getAllModelEntries()) {
  if (!entries.length) {
    setSelectedModel('', '');
    return null;
  }

  const explicitSelection = entries.find((entry) => (
    entry.profileId === state.selectedModelProfileId && entry.model === state.selectedModelName
  ));
  if (explicitSelection) {
    return explicitSelection;
  }

  const activeProfile = getActiveProfile();
  const activeModel = String(activeProfile?.model || '').trim();

  const fallbackSelection = (
    entries.find((entry) => entry.profileId === activeProfile?.id && entry.model === activeModel) ||
    entries.find((entry) => entry.profileId === activeProfile?.id) ||
    entries[0]
  );

  setSelectedModel(fallbackSelection?.profileId, fallbackSelection?.model);
  return fallbackSelection;
}

function setActiveProfile(profileId) {
  const profiles = getProfiles();
  const nextProfile = profiles.find((profile) => profile.id === profileId) || profiles[0] || null;
  if (!nextProfile) {
    state.activeProfileId = '';
    return;
  }

  state.activeProfileId = nextProfile.id;
  if (state.configStore) {
    state.configStore.activeProfileId = nextProfile.id;
  }
}

function setApiKeyVisibility(visible) {
  if (!dom.apiKeyInput || !dom.toggleApiKeyVisibilityButton) {
    return;
  }

  const isVisible = Boolean(visible);
  dom.apiKeyInput.type = isVisible ? 'text' : 'password';
  dom.toggleApiKeyVisibilityButton.classList.toggle('is-active', isVisible);
  dom.toggleApiKeyVisibilityButton.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
  dom.toggleApiKeyVisibilityButton.title = isVisible ? '隐藏 API Key' : '显示 API Key';
  dom.toggleApiKeyVisibilityButton.setAttribute('aria-label', isVisible ? '隐藏 API Key' : '显示 API Key');
}

function toggleApiKeyVisibility() {
  setApiKeyVisibility(dom.apiKeyInput?.type === 'password');
}

function resetPromptInput() {
  dom.promptInput.value = '';
  syncPromptHeight();
}

function resetChatState() {
  state.messages = [];
  state.currentRequestId = '';
  state.isGenerating = false;
  state.currentAnswerHost = null;
  state.currentAnswerRaw = '';
  state.promptAnchorRange = null;
}

function hideInlinePrompt(restoreFocus = false) {
  if (state.isGenerating) {
    return;
  }
  dom.inlinePrompt.hidden = true;
  dom.inlinePrompt.classList.remove('is-docked', 'is-generating');
  dom.inlinePrompt.style.left = '';
  dom.inlinePrompt.style.top = '';
  dom.inlinePrompt.style.bottom = '';
  dom.inlinePrompt.style.width = '';
  dom.promptStatusLabel.hidden = true;
  closeInlineModelPanel();
  resetPromptInput();
  state.promptAnchorRange = null;
  syncButtons();
  if (restoreFocus) {
    moveCaretToDocumentEnd();
  }
}

function applyConfigStore(configStore, configPath) {
  state.configStore = {
    activeProfileId: configStore?.activeProfileId || '',
    profiles: Array.isArray(configStore?.profiles)
      ? configStore.profiles.map((profile) => normalizeProfileDraft(profile))
      : []
  };

  if (!state.configStore.profiles.length) {
    state.configStore.profiles.push(
      normalizeProfileDraft({
        id: createProfileId(),
        name: '默认配置'
      })
    );
  }

  setActiveProfile(state.configStore.activeProfileId || state.configStore.profiles[0].id);
  const selectedEntry = getSelectedModelEntry();
  setSelectedModel(selectedEntry?.profileId, selectedEntry?.model);
  dom.configPath.textContent = configPath || '';
  renderProfilesList();
  fillProfileForm(getActiveProfile());
  renderInlineModelPicker();
}

function fillProfileForm(profile) {
  const current = normalizeProfileDraft(profile || {});
  dom.profileFormTitle.textContent = current.name || '编辑提供商';
  dom.profileNameInput.value = current.name || '';
  dom.apiUrlInput.value = current.apiUrl || '';
  dom.apiKeyInput.value = current.apiKey || '';
  dom.modelInput.value = current.model || '';
  dom.modelOptionsInput.value = current.modelOptions.join('\n');
  dom.proxyInput.value = current.proxyUrl || '';
  dom.tlsInput.checked = Boolean(current.ignoreTlsErrors);
  dom.systemPromptInput.value = current.systemPrompt || '';
  dom.temperatureInput.value = String(Number.isFinite(current.temperature) ? current.temperature : 0.7);
  dom.maxTokensInput.value = String(Number.isFinite(current.maxTokens) ? current.maxTokens : 16384);
  dom.deleteProfileButton.disabled = getProfiles().length <= 1;
}

function readProfileFromForm(existingProfileId = '') {
  return normalizeProfileDraft({
    id: existingProfileId,
    name: dom.profileNameInput.value.trim(),
    apiUrl: dom.apiUrlInput.value.trim(),
    apiKey: dom.apiKeyInput.value.trim(),
    model: dom.modelInput.value.trim(),
    modelOptions: dom.modelOptionsInput.value,
    proxyUrl: dom.proxyInput.value.trim(),
    ignoreTlsErrors: dom.tlsInput.checked,
    systemPrompt: dom.systemPromptInput.value,
    temperature: Number(dom.temperatureInput.value),
    maxTokens: Number(dom.maxTokensInput.value)
  });
}

function updateActiveProfileDraftFromForm() {
  const activeProfile = getActiveProfile();
  if (!activeProfile || !state.configStore) {
    return;
  }

  const nextProfile = readProfileFromForm(activeProfile.id);
  state.configStore.profiles = getProfiles().map((profile) => (
    profile.id === activeProfile.id ? nextProfile : profile
  ));
  state.configStore.activeProfileId = nextProfile.id;
  state.activeProfileId = nextProfile.id;
  renderProfilesList();
  renderInlineModelPicker();
  dom.profileFormTitle.textContent = nextProfile.name || '编辑提供商';
}

function renderProfilesList() {
  if (!dom.profilesList) {
    return;
  }

  dom.profilesList.innerHTML = '';
  const profiles = getProfiles();

  if (!profiles.length) {
    const empty = document.createElement('div');
    empty.className = 'profiles-empty';
    empty.textContent = '还没有提供商，点击右上角加号新增。';
    dom.profilesList.appendChild(empty);
    return;
  }

  profiles.forEach((profile) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'profile-item';
    if (profile.id === state.activeProfileId) {
      item.classList.add('is-active');
    }

    const name = document.createElement('span');
    name.className = 'profile-item-name';
    name.textContent = profile.name || '未命名提供商';

    const meta = document.createElement('span');
    meta.className = 'profile-item-meta';
    const modelCount = profile.modelOptions?.length || (profile.model ? 1 : 0);
    meta.textContent = `${modelCount} 个模型 · ${profile.apiUrl || '未填写接口地址'}`;

    item.append(name, meta);
    item.addEventListener('click', () => {
      updateActiveProfileDraftFromForm();
      setActiveProfile(profile.id);
      fillProfileForm(getActiveProfile());
      renderProfilesList();
      renderInlineModelPicker();
    });
    dom.profilesList.appendChild(item);
  });
}

function isInlineModelPanelOpen() {
  return Boolean(dom.inlineModelPanel) && !dom.inlineModelPanel.hidden;
}

function openInlineModelPanel() {
  if (!dom.inlineModelPanel || !dom.inlineModelTrigger || !getAllModelEntries().length || state.isGenerating) {
    return;
  }

  renderInlineModelPicker();
  dom.inlineModelPanel.hidden = false;
  dom.inlineModelTrigger.setAttribute('aria-expanded', 'true');
}

function closeInlineModelPanel() {
  if (!dom.inlineModelPanel || !dom.inlineModelTrigger) {
    return;
  }

  dom.inlineModelPanel.hidden = true;
  dom.inlineModelTrigger.setAttribute('aria-expanded', 'false');
}

function toggleInlineModelPanel() {
  if (isInlineModelPanelOpen()) {
    closeInlineModelPanel();
    return;
  }

  openInlineModelPanel();
}

function measureInlineModelPanelWidth(entries = []) {
  if (!entries.length || !dom.inlineModelTrigger) {
    return null;
  }

  const computedStyle = window.getComputedStyle(dom.inlineModelTrigger);
  const font = computedStyle.font || [
    computedStyle.fontStyle,
    computedStyle.fontVariant,
    computedStyle.fontWeight,
    computedStyle.fontSize,
    computedStyle.lineHeight === 'normal' ? '' : `/${computedStyle.lineHeight}`,
    computedStyle.fontFamily
  ].join(' ').trim();

  const canvas = measureInlineModelPanelWidth.canvas || document.createElement('canvas');
  measureInlineModelPanelWidth.canvas = canvas;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.font = font;
  const longestLabelWidth = entries.reduce((maxWidth, entry) => (
    Math.max(maxWidth, Math.ceil(context.measureText(entry.model).width))
  ), 0);

  return Math.max(180, Math.min(longestLabelWidth + 86, window.innerWidth - 64));
}

function renderInlineModelPicker() {
  const trigger = dom.inlineModelTrigger;
  const label = dom.inlineModelLabel;
  const list = dom.inlineModelList;
  const panel = dom.inlineModelPanel;
  if (!trigger || !label || !list || !panel) {
    return;
  }

  const entries = getAllModelEntries();
  const selectedEntry = getSelectedModelEntry(entries);

  list.innerHTML = '';

  if (!entries.length) {
    label.textContent = '未配置模型';
    trigger.disabled = true;
    trigger.title = '请先在设置中填写模型';
    closeInlineModelPanel();

    const empty = document.createElement('div');
    empty.className = 'inline-model-empty';
    empty.textContent = '还没有可用模型，请先在设置里填写。';
    list.appendChild(empty);
    panel.style.removeProperty('--inline-model-panel-width');
    return;
  }

  label.textContent = selectedEntry?.model || entries[0].model;
  trigger.title = selectedEntry
    ? `${selectedEntry.profileName} · ${selectedEntry.model}`
    : entries[0].model;
  trigger.disabled = state.isGenerating;

  entries.forEach((entry) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'inline-model-option';
    option.setAttribute('role', 'option');

    const isActive = selectedEntry?.profileId === entry.profileId && selectedEntry?.model === entry.model;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');

    const name = document.createElement('span');
    name.className = 'inline-model-option-name';
    name.textContent = entry.model;

    const stateTag = document.createElement('span');
    stateTag.className = 'inline-model-option-state';
    stateTag.textContent = isActive ? '当前' : '';

    option.append(name, stateTag);
    option.addEventListener('click', () => {
      void handleInlineModelSelect(entry);
    });
    list.appendChild(option);
  });

  const nextPanelWidth = measureInlineModelPanelWidth(entries);
  if (nextPanelWidth) {
    panel.style.setProperty('--inline-model-panel-width', `${nextPanelWidth}px`);
  } else {
    panel.style.removeProperty('--inline-model-panel-width');
  }
}

function syncButtons() {
  const visible = isInlinePromptVisible();
  const hasPrompt = Boolean(dom.promptInput.value.trim());
  dom.actionButton.disabled = !visible || (!state.isGenerating && !hasPrompt);
  dom.promptInput.disabled = state.isGenerating;
  dom.actionButton.classList.toggle('action-idle', !state.isGenerating && !hasPrompt);
  dom.actionButton.classList.toggle('action-send', !state.isGenerating && hasPrompt);
  dom.actionButton.classList.toggle('action-stop', state.isGenerating);
  dom.actionButton.title = state.isGenerating ? '停止生成' : '发送';
  dom.actionButton.setAttribute('aria-label', state.isGenerating ? '停止生成' : '发送');
  dom.inlinePrompt.classList.toggle('is-generating', state.isGenerating);
  dom.promptStatusLabel.hidden = !state.isGenerating;
  dom.promptInput.placeholder = state.isGenerating ? '' : PROMPT_PLACEHOLDER;
  dom.promptInput.setAttribute('aria-hidden', state.isGenerating ? 'true' : 'false');
  dom.newDocumentButton.disabled = state.isGenerating;
  dom.clearButton.disabled = state.isGenerating;
  if (dom.inlineModelTrigger) {
    dom.inlineModelTrigger.disabled = state.isGenerating || !getAllModelEntries().length;
  }
  syncDocumentItemActions();
  syncPromptHeight();
}

function syncDocumentItemActions() {
  const saveButtons = dom.documentsList.querySelectorAll('[data-doc-action="save"]');
  const deleteButtons = dom.documentsList.querySelectorAll('[data-doc-action="delete"]');

  saveButtons.forEach((button) => {
    button.disabled = state.isGenerating || !state.activeDocumentId || !state.isDirty;
  });

  deleteButtons.forEach((button) => {
    button.disabled = state.isGenerating || !state.activeDocumentId;
  });
}

function appendMessage(role, content = '') {
  state.messages.push({ role, content });
}

function getPendingAssistantMessage() {
  const last = state.messages[state.messages.length - 1];
  if (!last || last.role !== 'assistant') {
    return null;
  }
  return last;
}

function ensureDocumentRoot() {
  const directChildren = Array.from(dom.documentView.childNodes);
  const directRoots = directChildren.filter((node) => (
    node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('document-article')
  ));

  if (directRoots.length === 1 && directChildren.length === 1) {
    const [root] = directRoots;
    return root;
  }

  const root = document.createElement('article');
  root.className = 'document-article';

  directChildren.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('document-article')) {
      while (node.firstChild) {
        root.appendChild(node.firstChild);
      }
      return;
    }
    root.appendChild(node);
  });

  dom.documentView.innerHTML = '';
  dom.documentView.appendChild(root);
  return root;
}

function cleanupEmptyEditorArtifacts(root = ensureDocumentRoot()) {
  let changed = false;

  root.querySelectorAll('.doc-question').forEach((block) => {
    const text = block.textContent?.replace(/\u200B/g, '').trim() || '';
    if (!text) {
      block.remove();
      changed = true;
    }
  });

  root.querySelectorAll('.doc-answer').forEach((block) => {
    const text = block.textContent?.replace(/\u200B/g, '').trim() || '';
    const hasRenderable = block.querySelector('.diagram-block, .html-preview-block');
    if (!text && !hasRenderable) {
      block.remove();
      changed = true;
    }
  });

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || '').replace(/\u200B/g, '').trim()) {
      node.remove();
      changed = true;
    }
  });

  return changed;
}

function liftNestedDocBlocks(root = ensureDocumentRoot()) {
  const nestedBlocks = Array.from(root.querySelectorAll('.doc-block .doc-block'));
  if (!nestedBlocks.length) {
    return false;
  }

  let changed = false;
  const insertionMap = new Map();

  nestedBlocks.forEach((block) => {
    if (!root.contains(block)) {
      return;
    }

    const outer = block.parentElement?.closest('.doc-block');
    if (!outer || !root.contains(outer)) {
      return;
    }

    const previousInserted = insertionMap.get(outer) || outer;
    previousInserted.after(block);
    insertionMap.set(outer, block);
    changed = true;
  });

  return changed;
}

function normalizeDocumentStructure() {
  const root = ensureDocumentRoot();
  let changed = false;

  if (liftNestedDocBlocks(root)) {
    changed = true;
  }

  if (cleanupEmptyEditorArtifacts(root)) {
    changed = true;
  }

  root.querySelectorAll('.diagram-block, .html-preview-block').forEach((block) => {
    if (block.getAttribute('contenteditable') !== 'false') {
      block.setAttribute('contenteditable', 'false');
      changed = true;
    }
  });

  return changed;
}

function scrollDocumentToBottom() {
  window.requestAnimationFrame(() => {
    dom.documentView.scrollTop = dom.documentView.scrollHeight;
  });
}

function moveCaretToDocumentEnd() {
  dom.documentView.focus();

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(dom.documentView);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertEditorLineBreak() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const br = document.createElement('br');
  const spacer = document.createTextNode('\u200B');
  range.insertNode(br);
  br.parentNode.insertBefore(spacer, br.nextSibling);

  range.setStart(spacer, 1);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getCaretRect(range) {
  const rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) {
    return rect;
  }

  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  const cloned = range.cloneRange();
  cloned.insertNode(marker);
  const markerRect = marker.getBoundingClientRect();
  marker.remove();
  return markerRect;
}

function positionInlinePrompt(range) {
  dom.inlinePrompt.classList.remove('is-docked');
  dom.inlinePrompt.style.bottom = '';
  const referenceRect = dom.documentView.getBoundingClientRect();
  const caretRect = getCaretRect(range);
  const popupWidth = Math.min(680, Math.max(320, dom.documentView.clientWidth - 36));
  dom.inlinePrompt.style.width = `${popupWidth}px`;

  const left = Math.min(
    Math.max(12, caretRect.left - referenceRect.left),
    Math.max(12, dom.documentView.clientWidth - popupWidth - 12)
  );
  const top = Math.max(12, caretRect.bottom - referenceRect.top + 12);

  dom.inlinePrompt.style.left = `${left + dom.documentView.offsetLeft}px`;
  dom.inlinePrompt.style.top = `${top + dom.documentView.offsetTop}px`;
}

function updateDockedInlinePromptPosition() {
  if (!dom.inlinePrompt.classList.contains('is-docked')) {
    return;
  }

  const editorRect = dom.documentView.getBoundingClientRect();
  const popupWidth = Math.min(920, Math.max(360, editorRect.width - 40));
  const centerX = editorRect.left + editorRect.width / 2;

  dom.inlinePrompt.style.left = `${Math.round(centerX)}px`;
  dom.inlinePrompt.style.top = '';
  dom.inlinePrompt.style.bottom = '22px';
  dom.inlinePrompt.style.width = `${Math.round(popupWidth)}px`;
}

function dockInlinePrompt() {
  dom.inlinePrompt.classList.add('is-docked');
  updateDockedInlinePromptPosition();
}

function showInlinePromptAtSelection() {
  if (state.isGenerating) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!dom.documentView.contains(range.startContainer)) {
    return;
  }

  state.promptAnchorRange = normalizePromptAnchorRange(range) || range.cloneRange();
  dom.inlinePrompt.hidden = false;
  positionInlinePrompt(state.promptAnchorRange);
  syncButtons();
  syncPromptHeight();
  window.setTimeout(() => {
    dom.promptInput.focus();
  }, 0);
}

function isCaretAtLineStart() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false;
  }

  const range = selection.getRangeAt(0);
  if (!dom.documentView.contains(range.startContainer)) {
    return false;
  }

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer;
    const visibleText = String(textNode.textContent || '').replace(/\u200B/g, '');
    if (!visibleText && textNode.previousSibling?.nodeName === 'BR') {
      return true;
    }
  }

  if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
    const container = range.startContainer;
    const previousSibling = container.childNodes[range.startOffset - 1];
    if (previousSibling?.nodeName === 'BR') {
      return true;
    }
  }

  const prefixRange = range.cloneRange();
  prefixRange.selectNodeContents(dom.documentView);
  prefixRange.setEnd(range.endContainer, range.endOffset);
  const text = prefixRange.toString().replace(/\u200B/g, '');
  const currentLine = text.split('\n').pop() || '';
  return currentLine.trim().length === 0;
}

function normalizePromptAnchorRange(range) {
  if (!range) {
    return null;
  }

  const normalized = range.cloneRange();
  normalized.collapse(true);

  if (normalized.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = normalized.startContainer;
    const text = String(textNode.textContent || '').replace(/\u200B/g, '').trim();
    const previousSibling = textNode.previousSibling;

    if (!text && previousSibling?.nodeName === 'BR' && textNode.parentNode) {
      const parent = textNode.parentNode;
      const index = Array.prototype.indexOf.call(parent.childNodes, previousSibling);
      previousSibling.remove();
      textNode.remove();

      const compactRange = document.createRange();
      compactRange.setStart(parent, Math.max(0, index));
      compactRange.collapse(true);
      return compactRange;
    }
  }

  if (normalized.startContainer.nodeType === Node.ELEMENT_NODE) {
    const parent = normalized.startContainer;
    const previousSibling = parent.childNodes[normalized.startOffset - 1];
    const currentSibling = parent.childNodes[normalized.startOffset];

    if (
      previousSibling?.nodeName === 'BR' &&
      currentSibling?.nodeType === Node.TEXT_NODE &&
      !String(currentSibling.textContent || '').replace(/\u200B/g, '').trim()
    ) {
      previousSibling.remove();
      currentSibling.remove();

      const compactRange = document.createRange();
      compactRange.setStart(parent, Math.max(0, normalized.startOffset - 1));
      compactRange.collapse(true);
      return compactRange;
    }
  }

  return normalized;
}

function resolveSafePromptAnchorRange(range) {
  const root = ensureDocumentRoot();
  const normalized = normalizePromptAnchorRange(range);

  if (!normalized || !dom.documentView.contains(normalized.startContainer)) {
    return null;
  }

  const anchorNode = normalized.startContainer.nodeType === Node.ELEMENT_NODE
    ? normalized.startContainer
    : normalized.startContainer.parentElement;
  const block = anchorNode?.closest('.doc-block');

  if (block && root.contains(block)) {
    const safeRange = document.createRange();
    safeRange.setStartAfter(block);
    safeRange.collapse(true);
    return safeRange;
  }

  return normalized;
}

function insertBlockAtAnchor(node) {
  const root = ensureDocumentRoot();
  const range = resolveSafePromptAnchorRange(state.promptAnchorRange);

  if (!range || !dom.documentView.contains(range.startContainer)) {
    root.appendChild(node);
  } else {
    range.collapse(true);
    range.insertNode(node);
  }

  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  state.promptAnchorRange = after;
}

function appendQuestionBlock(text) {
  const section = document.createElement('section');
  section.className = 'doc-block doc-question';
  section.innerHTML = '<div class="doc-question-text"></div>';
  section.querySelector('.doc-question-text').textContent = text;
  insertBlockAtAnchor(section);
  scrollDocumentToBottom();
  queueAutosave(true);
}

function appendAnswerBlock() {
  const section = document.createElement('section');
  section.className = 'doc-block doc-answer';
  section.innerHTML = '<article class="markdown-body"></article>';
  insertBlockAtAnchor(section);
  state.currentAnswerHost = section.querySelector('.markdown-body');
  state.currentAnswerRaw = '';
  scrollDocumentToBottom();
  queueAutosave(true);
}

function normalizeReplyContent(content) {
  return String(content || '')
    .replace(/\r/g, '')
    .replace(/\n[ \t]*\n+/g, '\n')
    .trimEnd();
}

function updateCurrentAnswer(contentChunk) {
  if (!state.currentAnswerHost) {
    return;
  }
  state.currentAnswerRaw += contentChunk;
  state.currentAnswerHost.innerHTML = sanitizeRichHtml(markdown.render(normalizeReplyContent(state.currentAnswerRaw)));
  scheduleDiagramRender(state.currentAnswerHost);
  scrollDocumentToBottom();
  queueAutosave(true);
}

function getCurrentDocumentHtml() {
  normalizeDocumentStructure();
  return sanitizeRichHtml(dom.documentView.innerHTML);
}

function getCurrentDocumentText() {
  return (dom.documentView.innerText || dom.documentView.textContent || '')
    .replace(/\u200B/g, '')
    .replace(/\r/g, '')
    .trim();
}

function deriveDocumentTitle() {
  const lines = getCurrentDocumentText()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const fallback = '未命名文稿';
  if (!lines.length) {
    return fallback;
  }
  const title = lines[0].replace(/\s+/g, ' ');
  return title.length > 32 ? `${title.slice(0, 32)}…` : title;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function renderDocumentList() {
  dom.documentsList.innerHTML = '';

  if (!state.documents.length) {
    const empty = document.createElement('div');
    empty.className = 'documents-empty';
    empty.textContent = '还没有文档，点击上方加号创建。';
    dom.documentsList.appendChild(empty);
    return;
  }

  state.documents.forEach((doc) => {
    const isActive = doc.id === state.activeDocumentId;
    const item = document.createElement('article');
    item.className = 'document-item';
    if (isActive) {
      item.classList.add('is-active');
    }

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'document-item-main';

    const title = document.createElement('span');
    title.className = 'document-item-title';
    title.textContent = doc.title || '未命名文稿';

    const time = document.createElement('span');
    time.className = 'document-item-time';
    time.textContent = formatDateTime(doc.updatedAt);

    main.append(title, time);
    main.addEventListener('click', () => {
      openDocumentById(doc.id);
    });

    item.appendChild(main);

    if (isActive) {
      const actions = document.createElement('div');
      actions.className = 'document-item-actions';

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'document-item-action';
      saveButton.dataset.docAction = 'save';
      saveButton.title = state.isDirty ? '保存文档' : '当前文档已是最新';
      saveButton.setAttribute('aria-label', state.isDirty ? '保存文档' : '当前文档已是最新');
      saveButton.innerHTML = '<span aria-hidden="true">💾</span>';
      saveButton.disabled = state.isGenerating || !state.activeDocumentId || !state.isDirty;
      saveButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!state.isDirty) {
          setStatus('当前文档已是最新。');
          return;
        }
        await flushAutosave(false);
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'document-item-action danger';
      deleteButton.dataset.docAction = 'delete';
      deleteButton.title = '删除文档';
      deleteButton.setAttribute('aria-label', '删除文档');
      deleteButton.innerHTML = '<span aria-hidden="true">🗑️</span>';
      deleteButton.disabled = state.isGenerating || !state.activeDocumentId;
      deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteCurrentDocument();
      });

      actions.append(saveButton, deleteButton);
      item.appendChild(actions);
    }

    dom.documentsList.appendChild(item);
  });
}

function applyDocumentMeta(snapshot) {
  state.documents = Array.isArray(snapshot?.documents) ? snapshot.documents : [];
  state.documentsPath = snapshot?.documentsPath || '';
  state.activeDocumentId = snapshot?.activeDocument?.id || state.activeDocumentId || '';
  dom.documentsPath.textContent = state.documentsPath;
  renderDocumentList();
  syncButtons();
}

function loadDocumentIntoEditor(doc) {
  resetChatState();
  dom.documentView.innerHTML = sanitizeRichHtml(doc?.contentHtml || '');
  const normalized = normalizeDocumentStructure();
  scheduleDiagramRender(dom.documentView, 0);
  hideInlinePrompt(false);
  state.activeDocumentId = doc?.id || '';
  state.isDirty = false;
  renderDocumentList();
  if (normalized) {
    queueAutosave(true);
  }
  window.requestAnimationFrame(() => {
    moveCaretToDocumentEnd();
    scrollDocumentToBottom();
  });
}

async function persistDocument(silent = true) {
  if (!state.activeDocumentId) {
    return null;
  }

  if (state.isSaving) {
    state.pendingResave = true;
    return null;
  }

  state.isSaving = true;
  const payload = {
    id: state.activeDocumentId,
    title: deriveDocumentTitle(),
    contentHtml: getCurrentDocumentHtml()
  };

  try {
    const snapshot = await window.aiClient.saveDocument(payload);
    applyDocumentMeta(snapshot);
    state.isDirty = false;
    renderDocumentList();
    syncButtons();
    if (!silent) {
      setStatus('文档已保存。');
    }
    return snapshot;
  } catch (error) {
    setStatus(error.message || '文档保存失败。', 'error');
    return null;
  } finally {
    state.isSaving = false;
    if (state.pendingResave) {
      state.pendingResave = false;
      window.setTimeout(() => {
        persistDocument(true);
      }, 0);
    }
  }
}

function queueAutosave(silent = true) {
  state.isDirty = true;
  renderDocumentList();
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }
  state.saveTimer = window.setTimeout(() => {
    state.saveTimer = null;
    persistDocument(silent);
  }, AUTOSAVE_DELAY);
}

async function flushAutosave(silent = true) {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (!state.isDirty) {
    return null;
  }
  return persistDocument(silent);
}

async function openDocumentById(id) {
  if (!id || id === state.activeDocumentId || state.isGenerating) {
    return;
  }

  await flushAutosave(true);
  const snapshot = await window.aiClient.openDocument(id);
  applyDocumentMeta(snapshot);
  loadDocumentIntoEditor(snapshot.activeDocument);
  setStatus('已切换文档。');
}

async function createNewDocument() {
  if (state.isGenerating) {
    return;
  }

  await flushAutosave(true);
  const doc = await window.aiClient.createDocument({
    title: '未命名文稿',
    contentHtml: ''
  });
  const snapshot = await window.aiClient.openDocument(doc.id);
  applyDocumentMeta(snapshot);
  loadDocumentIntoEditor(snapshot.activeDocument);
  setStatus('已新建文档。');
}

async function deleteCurrentDocument() {
  if (!state.activeDocumentId || state.isGenerating) {
    return;
  }

  const confirmed = window.confirm('确定删除当前文档吗？');
  if (!confirmed) {
    return;
  }

  const snapshot = await window.aiClient.deleteDocument(state.activeDocumentId);
  applyDocumentMeta(snapshot);
  loadDocumentIntoEditor(snapshot.activeDocument);
  setStatus('当前文档已删除。');
}

function handleDocumentInput() {
  normalizeDocumentStructure();
  queueAutosave(true);
}

function getAdjacentRenderableBlock(direction = 'backward') {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!dom.documentView.contains(range.startContainer)) {
    return null;
  }

  let container = range.startContainer;
  let offset = range.startOffset;

  if (container.nodeType === Node.TEXT_NODE) {
    const text = String(container.textContent || '');
    const leading = text.slice(0, offset).replace(/\u200B/g, '').trim();
    const trailing = text.slice(offset).replace(/\u200B/g, '').trim();
    if (direction === 'backward' && leading) {
      return null;
    }
    if (direction === 'forward' && trailing) {
      return null;
    }
    offset = Array.prototype.indexOf.call(container.parentNode?.childNodes || [], container) + (direction === 'backward' ? 0 : 1);
    container = container.parentNode;
  }

  while (container && container !== dom.documentView) {
    if (container.nodeType !== Node.ELEMENT_NODE) {
      container = container.parentNode;
      continue;
    }

    const children = Array.from(container.childNodes);
    const startIndex = direction === 'backward' ? offset - 1 : offset;
    const step = direction === 'backward' ? -1 : 1;

    for (let index = startIndex; index >= 0 && index < children.length; index += step) {
      const candidate = children[index];
      if (!candidate) {
        continue;
      }
      if (candidate.nodeType === Node.TEXT_NODE && !String(candidate.textContent || '').replace(/\u200B/g, '').trim()) {
        continue;
      }
      if (candidate.nodeName === 'BR') {
        continue;
      }
      if (candidate.nodeType === Node.ELEMENT_NODE) {
        const renderable = candidate.matches('.diagram-block, .html-preview-block')
          ? candidate
          : candidate.querySelector?.('.diagram-block, .html-preview-block');
        if (renderable) {
          return renderable;
        }
      }
      return null;
    }

    offset = Array.prototype.indexOf.call(container.parentNode?.childNodes || [], container) + (direction === 'backward' ? 0 : 1);
    container = container.parentNode;
  }

  return null;
}

async function handleSaveSettings() {
  updateActiveProfileDraftFromForm();
  const result = await window.aiClient.saveConfig(state.configStore);
  applyConfigStore(result.configStore, result.configPath);
  setStatus('配置已保存到本地。');
  closeSettingsModal();
}

function createProfile() {
  const activeProfile = getActiveProfile();
  const profiles = getProfiles();
  const nextProfile = normalizeProfileDraft({
    ...activeProfile,
    id: createProfileId(),
    name: `提供商 ${profiles.length + 1}`,
    apiKey: '',
    model: activeProfile?.model || ''
  });

  if (!state.configStore) {
    state.configStore = {
      activeProfileId: nextProfile.id,
      profiles: [nextProfile]
    };
  } else {
    updateActiveProfileDraftFromForm();
    state.configStore.profiles = [...getProfiles(), nextProfile];
    state.configStore.activeProfileId = nextProfile.id;
  }

  setActiveProfile(nextProfile.id);
  renderProfilesList();
  fillProfileForm(nextProfile);
  renderInlineModelPicker();
  setStatus('已新增提供商，可继续填写。');
}

function deleteActiveProfile() {
  const activeProfile = getActiveProfile();
  const profiles = getProfiles();
  if (!activeProfile || profiles.length <= 1) {
    return;
  }

  const confirmed = window.confirm(`确定删除提供商“${activeProfile.name}”吗？`);
  if (!confirmed) {
    return;
  }

  const nextProfiles = profiles.filter((profile) => profile.id !== activeProfile.id);
  state.configStore.profiles = nextProfiles;
  state.configStore.activeProfileId = nextProfiles[0].id;
  setActiveProfile(nextProfiles[0].id);
  renderProfilesList();
  fillProfileForm(getActiveProfile());
  renderInlineModelPicker();
  setStatus('已删除当前提供商。');
}

async function handleInlineModelSelect(entry) {
  if (!entry || !state.configStore) {
    return;
  }

  const selectedEntry = getSelectedModelEntry();
  const isSameSelection = selectedEntry?.profileId === entry.profileId && selectedEntry?.model === entry.model;

  closeInlineModelPanel();

  if (isSameSelection) {
    return;
  }

  state.configStore.profiles = getProfiles().map((profile) => (
    profile.id === entry.profileId
      ? normalizeProfileDraft({ ...profile, model: entry.model })
      : profile
  ));
  state.configStore.activeProfileId = entry.profileId;
  setActiveProfile(entry.profileId);
  setSelectedModel(entry.profileId, entry.model);

  fillProfileForm(getActiveProfile());
  renderProfilesList();
  renderInlineModelPicker();
  const result = await window.aiClient.saveConfig(state.configStore);
  applyConfigStore(result.configStore, result.configPath);
  setStatus(`已切换到 ${entry.model}`);
}

async function handleSend() {
  const prompt = dom.promptInput.value.trim();
  if (!prompt || state.isGenerating || !state.promptAnchorRange) {
    return;
  }

  if (!state.configStore) {
    return;
  }

  if (!dom.settingsModal.hidden) {
    updateActiveProfileDraftFromForm();
  }

  const activeProfile = getActiveProfile();
  if (!activeProfile) {
    setStatus('请先添加并填写一个可用配置。', 'error');
    return;
  }

  const selectedEntry = getSelectedModelEntry();
  const requestSourceProfile = getProfiles().find((profile) => (
    profile.id === (selectedEntry?.profileId || activeProfile.id)
  )) || activeProfile;
  const selectedModel = selectedEntry?.model || requestSourceProfile.model;
  const requestProfile = normalizeProfileDraft({
    ...requestSourceProfile,
    model: selectedModel
  });
  setSelectedModel(requestSourceProfile.id, selectedModel);

  appendMessage('user', prompt);
  appendMessage('assistant', '');
  appendQuestionBlock(prompt);
  appendAnswerBlock();

  state.isGenerating = true;
  dom.promptInput.value = '';
  dockInlinePrompt();
  syncButtons();
  setStatus('正在生成中…');
  syncPromptHeight();

  try {
    await window.aiClient.startChat({
      config: requestProfile,
      messages: state.messages
    });
  } catch (error) {
    const pending = getPendingAssistantMessage();
    if (pending && !pending.content.trim()) {
      state.messages.pop();
    }
    if (state.currentAnswerHost && !state.currentAnswerRaw.trim()) {
      state.currentAnswerHost.closest('.doc-answer')?.remove();
      state.currentAnswerHost = null;
      state.currentAnswerRaw = '';
    }
    state.isGenerating = false;
    syncButtons();
    queueAutosave(true);
    setStatus(error.message || '请求启动失败。', 'error');
  }
}

async function handleStop() {
  if (!state.isGenerating) {
    return;
  }
  await window.aiClient.stopChat();
}

function clearConversation() {
  if (state.isGenerating) {
    return;
  }
  resetChatState();
  dom.documentView.innerHTML = '';
  hideInlinePrompt(false);
  queueAutosave(false);
  setStatus('已清空当前文档内容。');
}

function finalizeGeneration(message, tone = 'normal') {
  scheduleDiagramRender(dom.documentView, 0);
  state.isGenerating = false;
  state.currentAnswerHost = null;
  state.currentAnswerRaw = '';
  syncButtons();
  hideInlinePrompt(true);
  queueAutosave(true);
  setStatus(message, tone);
}

function handleChatEvent(payload) {
  if (!payload) {
    return;
  }

  if (payload.type === 'started') {
    state.currentRequestId = payload.requestId;
    return;
  }

  if (payload.requestId && state.currentRequestId && payload.requestId !== state.currentRequestId) {
    return;
  }

  if (payload.type === 'chunk') {
    const pending = getPendingAssistantMessage();
    if (!pending) {
      return;
    }
    pending.content += payload.chunk;
    updateCurrentAnswer(payload.chunk);
    return;
  }

  if (payload.type === 'done') {
    finalizeGeneration('生成完成。');
    return;
  }

  if (payload.type === 'aborted') {
    finalizeGeneration(payload.message || '已停止生成。');
    return;
  }

  if (payload.type === 'error') {
    finalizeGeneration(payload.message || '请求失败。', 'error');
  }
}

async function bootstrap() {
  if (!window.aiClient) {
    throw new Error('预加载桥接未生效，请重启应用。');
  }

  applyTheme(loadTheme());
  applyEditorBackground(loadEditorBackground());

  const [{ configStore, configPath }, snapshot] = await Promise.all([
    window.aiClient.loadConfig(),
    window.aiClient.initDocuments()
  ]);

  applyConfigStore(configStore, configPath);
  applyDocumentMeta(snapshot);
  loadDocumentIntoEditor(snapshot.activeDocument);
  syncButtons();
  syncPromptHeight();
  setStatus('就绪。');

  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.toggleApiKeyVisibilityButton?.addEventListener('click', toggleApiKeyVisibility);
  dom.backgroundToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleBackgroundPanel();
  });
  dom.backgroundPanel?.querySelectorAll('[data-editor-bg]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setEditorBackground(button.dataset.editorBg || 'default');
    });
  });
  dom.settingsToggle.addEventListener('click', openSettingsModal);
  dom.settingsClose.addEventListener('click', closeSettingsModal);
  dom.addProfileButton?.addEventListener('click', createProfile);
  dom.deleteProfileButton?.addEventListener('click', deleteActiveProfile);
  dom.settingsModal.addEventListener('click', (event) => {
    if (event.target === dom.settingsModal) {
      closeSettingsModal();
    }
  });

  dom.saveSettingsButton.addEventListener('click', handleSaveSettings);
  [
    dom.profileNameInput,
    dom.apiUrlInput,
    dom.apiKeyInput,
    dom.modelInput,
    dom.modelOptionsInput,
    dom.proxyInput,
    dom.tlsInput,
    dom.systemPromptInput,
    dom.temperatureInput,
    dom.maxTokensInput
  ].forEach((field) => {
    field?.addEventListener(field === dom.tlsInput ? 'change' : 'input', () => {
      if (dom.settingsModal.hidden) {
        return;
      }
      updateActiveProfileDraftFromForm();
    });
  });
  dom.newDocumentButton.addEventListener('click', createNewDocument);
  dom.inlineModelTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleInlineModelPanel();
  });
  dom.actionButton.addEventListener('click', () => {
    if (state.isGenerating) {
      handleStop();
      return;
    }
    handleSend();
  });
  dom.clearButton.addEventListener('click', clearConversation);
  dom.promptInput.addEventListener('input', syncButtons);
  dom.promptInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    if (event.ctrlKey) {
      return;
    }
    if (event.isComposing) {
      return;
    }
    if (!event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });

  dom.documentView.addEventListener('input', handleDocumentInput);
  dom.documentView.addEventListener('click', (event) => {
    const trigger = event.target.closest('.diagram-expand-button');
    if (!trigger) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openDiagramPreview(trigger.closest('.diagram-block'));
  });
  dom.documentView.addEventListener('keydown', (event) => {
    if (
      event.key === ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      isCaretAtLineStart()
    ) {
      event.preventDefault();
      showInlinePromptAtSelection();
      return;
    }

    if ((event.key === 'Backspace' || event.key === 'Delete') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const block = getAdjacentRenderableBlock(event.key === 'Backspace' ? 'backward' : 'forward');
      if (block) {
        event.preventDefault();
        block.remove();
        normalizeDocumentStructure();
        queueAutosave(true);
        return;
      }
    }

    if (event.key !== 'Enter' || event.isComposing) {
      return;
    }
    event.preventDefault();
    insertEditorLineBreak();
    queueAutosave(true);
  });

  document.addEventListener('mousedown', (event) => {
    if (
      isBackgroundPanelOpen() &&
      dom.backgroundPanel &&
      !dom.backgroundPanel.contains(event.target) &&
      dom.backgroundToggle &&
      !dom.backgroundToggle.contains(event.target)
    ) {
      closeBackgroundPanel();
    }

    if (
      isInlineModelPanelOpen() &&
      dom.inlineModelPanel &&
      !dom.inlineModelPanel.contains(event.target) &&
      dom.inlineModelTrigger &&
      !dom.inlineModelTrigger.contains(event.target)
    ) {
      closeInlineModelPanel();
    }

    if (!isInlinePromptVisible()) {
      return;
    }
    if (dom.inlinePrompt.contains(event.target)) {
      return;
    }
    hideInlinePrompt(false);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isDiagramPreviewOpen()) {
      closeDiagramPreview();
      return;
    }
    if (event.key === 'Escape' && isInlineModelPanelOpen()) {
      closeInlineModelPanel();
      return;
    }
    if (event.key === 'Escape' && isBackgroundPanelOpen()) {
      closeBackgroundPanel();
      return;
    }
    if (event.key === 'Escape' && !dom.settingsModal.hidden) {
      closeSettingsModal();
      return;
    }
    if (event.key === 'Escape' && isInlinePromptVisible()) {
      hideInlinePrompt(true);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
  });
  window.addEventListener('resize', () => {
    updateDockedInlinePromptPosition();
  });
  window.addEventListener('blur', () => {
    flushAutosave(true);
  });

  dom.diagramPreviewClose?.addEventListener('click', closeDiagramPreview);
  dom.diagramPreviewModal?.addEventListener('click', (event) => {
    if (event.target === dom.diagramPreviewModal) {
      closeDiagramPreview();
    }
  });

  window.aiClient.onChatEvent(handleChatEvent);
}

bootstrap().catch((error) => {
  setStatus(error.message || '初始化失败。', 'error');
});
