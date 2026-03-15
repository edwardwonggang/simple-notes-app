const { Agent, ProxyAgent, fetch } = require('undici');

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
    const delta = choice.delta?.content ?? choice.message?.content ?? '';
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

    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex >= 0) {
      const eventText = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      const parsed = parseSseEvent(eventText);

      if (parsed?.delta) {
        onChunk(parsed.delta);
      }

      if (parsed?.done || parsed?.finishReason) {
        return;
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }
  }

  const tail = parseSseEvent(buffer);
  if (tail?.delta) {
    onChunk(tail.delta);
  }
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

    await readStream(response, onChunk, signal);
  } finally {
    await dispatcher.close().catch(() => {});
  }
}

module.exports = {
  streamChatCompletion,
  normalizeApiUrl
};
