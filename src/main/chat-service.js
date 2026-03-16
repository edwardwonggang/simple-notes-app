const { Agent, ProxyAgent, fetch } = require('undici');
const { debugLog } = require('./debug-log');

function flattenContentPart(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenContentPart(item)).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  if (typeof value.text === 'string') {
    return value.text;
  }

  if (typeof value.content === 'string') {
    return value.content;
  }

  if (Array.isArray(value.content)) {
    return value.content.map((item) => flattenContentPart(item)).join('');
  }

  if (typeof value.reasoning_content === 'string') {
    return value.reasoning_content;
  }

  if (typeof value.reasoning === 'string') {
    return value.reasoning;
  }

  return '';
}

function extractChoiceText(choice = {}) {
  return flattenContentPart(
    choice.delta?.content ??
    choice.delta?.text ??
    choice.message?.content ??
    choice.text ??
    choice.reasoning ??
    choice.delta?.reasoning ??
    ''
  );
}

function extractResponseText(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (Array.isArray(payload.choices) && payload.choices.length) {
    return payload.choices.map((choice) => extractChoiceText(choice)).join('');
  }

  if (Array.isArray(payload.output)) {
    return payload.output.map((item) => flattenContentPart(item)).join('');
  }

  if (payload.message) {
    return flattenContentPart(payload.message);
  }

  return flattenContentPart(payload.content ?? payload.text ?? '');
}

function normalizeApiUrl(input) {
  const value = String(input || '').trim();
  if (!value) {
    return '';
  }
  if (value.endsWith('/chat/completions')) {
    return value;
  }
  if (value.endsWith('/v1')) {
    return `${value}/chat/completions`;
  }
  if (value.endsWith('/v1/')) {
    return `${value}chat/completions`;
  }
  return `${value.replace(/\/+$/, '')}/v1/chat/completions`;
}

function createDispatcher(config) {
  const rejectUnauthorized = !config.ignoreTlsErrors;

  if (config.proxyUrl) {
    return new ProxyAgent({
      uri: config.proxyUrl,
      requestTls: {
        rejectUnauthorized
      }
    });
  }

  return new Agent({
    connect: {
      rejectUnauthorized
    }
  });
}

function buildRequestBody(config, messages) {
  const body = {
    model: config.model,
    messages,
    stream: true,
    temperature: Number(config.temperature),
    max_tokens: Number(config.maxTokens || 16384)
  };

  return JSON.stringify(body);
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('data:'));

  if (!lines.length) {
    return null;
  }

  const payload = lines.map((line) => line.slice(5).trimStart()).join('\n');
  if (!payload) {
    return null;
  }
  if (payload === '[DONE]') {
    return { done: true };
  }

  try {
    const json = JSON.parse(payload);
    const choice = json.choices?.[0] || {};
    const delta = extractChoiceText(choice);
    const finishReason = choice.finish_reason ?? null;
    return {
      done: false,
      delta: typeof delta === 'string' ? delta : '',
      finishReason
    };
  } catch (_error) {
    return null;
  }
}

function findSseBoundary(buffer) {
  const lfBoundary = buffer.indexOf('\n\n');
  const crlfBoundary = buffer.indexOf('\r\n\r\n');

  if (lfBoundary < 0) {
    return crlfBoundary;
  }

  if (crlfBoundary < 0) {
    return lfBoundary;
  }

  return Math.min(lfBoundary, crlfBoundary);
}

async function readStream(response, onChunk, signal) {
  if (!response.body) {
    throw new Error('响应体为空，无法进行流式读取。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    if (signal.aborted) {
      throw new Error('请求已取消。');
    }

    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundaryIndex = findSseBoundary(buffer);
    while (boundaryIndex >= 0) {
      const eventText = buffer.slice(0, boundaryIndex);
      const boundaryLength = buffer.startsWith('\r\n\r\n', boundaryIndex) ? 4 : (buffer.slice(boundaryIndex, boundaryIndex + 4) === '\r\n\r\n' ? 4 : 2);
      buffer = buffer.slice(boundaryIndex + boundaryLength);
      const parsed = parseSseEvent(eventText);

      if (parsed?.delta) {
        debugLog('chat.stream', 'received stream chunk', { length: parsed.delta.length });
        onChunk(parsed.delta);
      }

      if (parsed?.done || parsed?.finishReason) {
        return;
      }

      boundaryIndex = findSseBoundary(buffer);
    }
  }

  const tail = parseSseEvent(buffer);
  if (tail?.delta) {
    onChunk(tail.delta);
  }
}

async function readJsonResponse(response, onChunk) {
  const payload = await response.json();
  const text = extractResponseText(payload);
  if (text) {
    debugLog('chat.json', 'received json response', { length: text.length });
    onChunk(text);
    return;
  }

  throw new Error('接口已返回结果，但未解析到可显示的文本内容。');
}

async function streamChatCompletion(config, messages, signal, onChunk) {
  const apiUrl = normalizeApiUrl(config.apiUrl);
  if (!apiUrl) {
    throw new Error('请先填写 API URL。');
  }
  if (!config.apiKey) {
    throw new Error('请先填写 API Key。');
  }
  if (!config.model) {
    throw new Error('请先填写模型 ID。');
  }
  if (!Array.isArray(messages) || !messages.length) {
    throw new Error('消息内容为空。');
  }

  const dispatcher = createDispatcher(config);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      dispatcher,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: buildRequestBody(config, messages),
      signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    debugLog('chat.request', 'response received', {
      apiUrl,
      model: config.model,
      status: response.status,
      contentType
    });
    if (contentType.includes('text/event-stream')) {
      await readStream(response, onChunk, signal);
      return;
    }

    await readJsonResponse(response, onChunk);
  } finally {
    await dispatcher.close().catch(() => {});
  }
}

module.exports = {
  streamChatCompletion,
  normalizeApiUrl
};
