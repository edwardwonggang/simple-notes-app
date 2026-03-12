import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'

function normalizeProxyUrl(value) {
  const proxyUrl = String(value || '').trim()
  if (!proxyUrl) {
    return ''
  }
  if (/^[a-z]+:\/\//i.test(proxyUrl)) {
    return proxyUrl
  }
  return `http://${proxyUrl}`
}

function readWindowsRegistryValue(valueName) {
  if (process.platform !== 'win32') {
    return ''
  }

  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', valueName],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )

    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const targetLine = lines.find((line) => line.toLowerCase().startsWith(valueName.toLowerCase()))
    if (!targetLine) {
      return ''
    }

    const parts = targetLine.split(/\s{2,}/).filter(Boolean)
    return parts[parts.length - 1] || ''
  } catch (_error) {
    return ''
  }
}

function parseWindowsProxyServer(rawValue, targetUrl) {
  const value = String(rawValue || '').trim()
  if (!value) {
    return ''
  }

  const targetProtocol = new URL(targetUrl).protocol === 'https:' ? 'https' : 'http'
  if (value.includes('=')) {
    const entries = value.split(';').map((item) => item.trim()).filter(Boolean)
    const matchedEntry = entries.find((entry) => entry.toLowerCase().startsWith(`${targetProtocol}=`))
      || entries.find((entry) => entry.toLowerCase().startsWith('http='))
      || entries[0]
    const proxyValue = matchedEntry.includes('=') ? matchedEntry.slice(matchedEntry.indexOf('=') + 1) : matchedEntry
    return normalizeProxyUrl(proxyValue)
  }

  return normalizeProxyUrl(value)
}

function getEnvProxyUrl(targetUrl) {
  const protocol = new URL(targetUrl).protocol
  const env = process.env
  const candidates = protocol === 'https:'
    ? [env.HTTPS_PROXY, env.https_proxy, env.HTTP_PROXY, env.http_proxy, env.ALL_PROXY, env.all_proxy]
    : [env.HTTP_PROXY, env.http_proxy, env.ALL_PROXY, env.all_proxy]

  for (const candidate of candidates) {
    const proxyUrl = normalizeProxyUrl(candidate)
    if (proxyUrl) {
      return proxyUrl
    }
  }

  return ''
}

function getWindowsSystemProxyUrl(targetUrl) {
  if (process.platform !== 'win32') {
    return ''
  }

  const proxyEnabled = readWindowsRegistryValue('ProxyEnable')
  if (proxyEnabled !== '0x1' && proxyEnabled !== '1') {
    return ''
  }

  return parseWindowsProxyServer(readWindowsRegistryValue('ProxyServer'), targetUrl)
}

function getDispatcher(config, targetUrl) {
  const proxyUrl = normalizeProxyUrl(config.proxyUrl || '')
    || getEnvProxyUrl(targetUrl)
    || getWindowsSystemProxyUrl(targetUrl)
  const allowInsecureTls = Boolean(config.allowInsecureTls)

  if (proxyUrl) {
    const tlsOptions = allowInsecureTls ? { rejectUnauthorized: false } : undefined
    return new ProxyAgent({
      uri: proxyUrl,
      requestTls: tlsOptions,
      proxyTls: tlsOptions
    })
  }

  if (allowInsecureTls) {
    return new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  }

  return null
}

const raw = await readFile(new URL('../config.local.json', import.meta.url), 'utf8')
const config = JSON.parse(raw)
const targetUrl = `${String(config.baseUrl || '').replace(/\/$/, '')}/chat/completions`
const dispatcher = getDispatcher(config, targetUrl)

const response = await undiciFetch(targetUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  },
  body: JSON.stringify({
    model: config.model,
    temperature: 0,
    max_tokens: 192,
    extra_body: {
      chat_template_kwargs: {
        thinking: false
      }
    },
    stream: false,
    messages: [
      {
        role: 'user',
        content: '请只回复：OK'
      }
    ]
  }),
  ...(dispatcher ? { dispatcher } : {})
})

if (!response.ok) {
  const text = await response.text()
  throw new Error(`NVIDIA API 请求失败：HTTP ${response.status} ${text}`)
}

const json = await response.json()
const message = json?.choices?.[0]?.message ?? {}
const content = message?.content ?? message?.reasoning_content
const output = typeof content === 'string' ? content.trim() : JSON.stringify(content)

console.log('API smoke test passed')
console.log(`model=${config.model}`)
console.log(`reply=${output}`)
