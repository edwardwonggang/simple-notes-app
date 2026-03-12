import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'
import { defineConfig } from 'vite'
import { copyFile } from 'wpsjs/vite_plugins'

const CONFIG_FILE = new URL('./config.local.json', import.meta.url)
const DISPATCHER_CACHE = new Map()

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

function parseBoolean(value, fallbackValue = false) {
    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['1', 'true', 'yes', 'on'].includes(normalized)) {
            return true
        }
        if (['0', 'false', 'no', 'off'].includes(normalized)) {
            return false
        }
    }

    return fallbackValue
}

async function readLocalConfig() {
    const raw = await readFile(CONFIG_FILE, 'utf8')
    const parsed = JSON.parse(raw)

    if (!parsed.baseUrl || !parsed.apiKey || !parsed.model) {
        throw new Error('config.local.json 缺少 baseUrl、apiKey 或 model')
    }

    return {
        ...parsed,
        proxyUrl: normalizeProxyUrl(parsed.proxyUrl || ''),
        allowInsecureTls: Boolean(parsed.allowInsecureTls),
        temperature: parsed.temperature ?? 0.2,
        maxTokens: parsed.maxTokens ?? 8192
    }
}

function normalizeConfigInput(input, previousConfig) {
    const current = previousConfig || {}
    const baseUrl = String(input.baseUrl || current.baseUrl || '').trim()
    const model = String(input.model || current.model || '').trim()
    const apiKey = String(input.apiKey || current.apiKey || '').trim()
    const proxyUrl = normalizeProxyUrl(input.proxyUrl || current.proxyUrl || '')
    const allowInsecureTls = parseBoolean(
        input.allowInsecureTls,
        parseBoolean(current.allowInsecureTls, false)
    )
    const temperature = Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : (current.temperature ?? 0.2)
    const maxTokens = Number.isFinite(Number(input.maxTokens)) ? Number(input.maxTokens) : (current.maxTokens ?? 8192)

    if (!baseUrl) {
        throw new Error('请填写 API URL')
    }
    if (!model) {
        throw new Error('请填写模型 ID')
    }
    if (!apiKey) {
        throw new Error('请填写 API Key')
    }

    return {
        baseUrl,
        apiKey,
        model,
        proxyUrl,
        allowInsecureTls,
        temperature,
        maxTokens
    }
}

async function writeLocalConfig(input) {
    const previousConfig = await readLocalConfig()
    const nextConfig = normalizeConfigInput(input, previousConfig)
    await writeFile(CONFIG_FILE, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
    return nextConfig
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
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

function resolveProxyUrl(config, targetUrl) {
    return normalizeProxyUrl(config && config.proxyUrl)
        || getEnvProxyUrl(targetUrl)
        || getWindowsSystemProxyUrl(targetUrl)
}

function getProxySource(config, targetUrl) {
    if (normalizeProxyUrl(config && config.proxyUrl)) {
        return 'config'
    }
    if (getEnvProxyUrl(targetUrl)) {
        return 'env'
    }
    if (getWindowsSystemProxyUrl(targetUrl)) {
        return 'windows'
    }
    return ''
}

function getDispatcher(config, targetUrl) {
    const proxyUrl = resolveProxyUrl(config, targetUrl)
    const allowInsecureTls = Boolean(config && config.allowInsecureTls)
    const cacheKey = JSON.stringify({ proxyUrl, allowInsecureTls })

    if (DISPATCHER_CACHE.has(cacheKey)) {
        return DISPATCHER_CACHE.get(cacheKey)
    }

    let dispatcher = null
    if (proxyUrl) {
        const tlsOptions = allowInsecureTls ? { rejectUnauthorized: false } : undefined
        dispatcher = new ProxyAgent({
            uri: proxyUrl,
            requestTls: tlsOptions,
            proxyTls: tlsOptions
        })
    } else if (allowInsecureTls) {
        dispatcher = new Agent({
            connect: {
                rejectUnauthorized: false
            }
        })
    }

    DISPATCHER_CACHE.set(cacheKey, dispatcher)
    return dispatcher
}

function formatErrorMessage(error) {
    const messages = []
    let current = error

    while (current) {
        if (current.code && !messages.includes(current.code)) {
            messages.push(current.code)
        }
        if (current.message && !messages.includes(current.message)) {
            messages.push(current.message)
        }
        current = current.cause
    }

    return messages.filter(Boolean).join(' | ') || String(error)
}

function buildNetworkHint(error, config, targetUrl) {
    const details = formatErrorMessage(error).toLowerCase()
    if (/self[- ]signed|certificate|unable_to_verify|unable to verify/.test(details)) {
        return '可能被公司代理替换了 HTTPS 证书。可先填写代理 URL；如果仍失败，再临时开启“忽略 TLS 证书错误”。'
    }

    if (/fetch failed|econnreset|etimedout|enetunreach|ehostunreach|socket hang up|eai_again/.test(details)) {
        if (resolveProxyUrl(config, targetUrl)) {
            return `当前请求已走代理（来源：${getProxySource(config, targetUrl)}），请检查代理地址或代理权限。`
        }
        if (process.platform === 'win32') {
            return '如在公司网络中，可在设置里填写代理 URL。若 Windows 已配置系统代理，重启本地服务后会自动尝试读取。'
        }
        return '如在公司网络中，请在设置里填写代理 URL 后重试。'
    }

    return ''
}

async function pipeResponseStream(upstreamResponse, res) {
    res.statusCode = upstreamResponse.status
    res.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders()
    }

    if (!upstreamResponse.body) {
        res.end()
        return
    }

    for await (const chunk of upstreamResponse.body) {
        res.write(Buffer.from(chunk))
    }

    res.end()
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function createAiProxyMiddleware() {
    return async function aiProxyMiddleware(req, res, next) {
        const method = req.method || 'GET'
        const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : ''

        if (method === 'GET' && pathname === '/api/config') {
            try {
                const config = await readLocalConfig()
                sendJson(res, 200, {
                    baseUrl: config.baseUrl,
                    apiKey: config.apiKey,
                    model: config.model,
                    proxyUrl: config.proxyUrl || '',
                    allowInsecureTls: Boolean(config.allowInsecureTls),
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                    proxyPath: '/api/chat'
                })
            } catch (error) {
                sendJson(res, 500, {
                    error: error.message || String(error)
                })
            }
            return
        }

        if (method === 'POST' && pathname === '/api/config') {
            try {
                const rawBody = await readRequestBody(req)
                const incomingPayload = rawBody ? JSON.parse(rawBody) : {}
                const config = await writeLocalConfig(incomingPayload)

                sendJson(res, 200, {
                    baseUrl: config.baseUrl,
                    apiKey: config.apiKey,
                    model: config.model,
                    proxyUrl: config.proxyUrl || '',
                    allowInsecureTls: Boolean(config.allowInsecureTls),
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                    proxyPath: '/api/chat'
                })
            } catch (error) {
                sendJson(res, 400, {
                    error: error.message || String(error)
                })
            }
            return
        }

        if (method === 'POST' && pathname === '/api/chat') {
            try {
                const config = await readLocalConfig()
                const rawBody = await readRequestBody(req)
                const incomingPayload = rawBody ? JSON.parse(rawBody) : {}
                const wantsStream = Boolean(incomingPayload.stream)

                if (!Array.isArray(incomingPayload.messages) || !incomingPayload.messages.length) {
                    sendJson(res, 400, { error: '请求缺少 messages' })
                    return
                }

                const extraBody = incomingPayload.extra_body || {}
                const chatTemplateKwargs = extraBody.chat_template_kwargs || {}
                const upstreamPayload = {
                    ...incomingPayload,
                    model: incomingPayload.model || config.model,
                    temperature: incomingPayload.temperature ?? config.temperature,
                    max_tokens: incomingPayload.max_tokens ?? config.maxTokens,
                    stream: Boolean(incomingPayload.stream),
                    extra_body: {
                        ...extraBody,
                        chat_template_kwargs: {
                            ...chatTemplateKwargs,
                            thinking: false
                        }
                    }
                }

                const upstreamUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
                const dispatcher = getDispatcher(config, upstreamUrl)
                const response = await undiciFetch(upstreamUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': wantsStream ? 'text/event-stream' : 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify(upstreamPayload),
                    ...(dispatcher ? { dispatcher } : {})
                })

                if (wantsStream) {
                    if (!response.ok) {
                        const text = await response.text()
                        sendJson(res, response.status, { error: text || `HTTP ${response.status}` })
                        return
                    }

                    await pipeResponseStream(response, res)
                    return
                }

                const text = await response.text()
                res.statusCode = response.status
                res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8')
                res.end(text)
            } catch (error) {
                const config = await readLocalConfig().catch(() => null)
                const upstreamUrl = config && config.baseUrl
                    ? `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
                    : ''
                const detail = formatErrorMessage(error)
                const hint = upstreamUrl ? buildNetworkHint(error, config, upstreamUrl) : ''
                sendJson(res, 500, {
                    error: hint ? `${detail}。${hint}` : detail
                })
            }
            return
        }

        next()
    }
}

function aiProxyPlugin() {
    const middleware = createAiProxyMiddleware()

    return {
        name: 'wps-ai-proxy',
        configureServer(server) {
            server.middlewares.use(middleware)
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware)
        }
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        aiProxyPlugin(),
        copyFile({ src: 'manifest.xml', dest: 'manifest.xml' }),
        copyFile({ src: 'js', dest: 'js' }),
        copyFile({ src: 'images', dest: 'images' }),
        copyFile({ src: 'ui', dest: 'ui' }),
        copyFile({ src: 'main.js', dest: 'main.js' }),
        copyFile({ src: 'ribbon.xml', dest: 'ribbon.xml' }),
        copyFile({ src: 'config.example.json', dest: 'config.example.json' }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        host: '0.0.0.0',
        fs: {
            deny: ['config.local.json']
        }
    }
})
