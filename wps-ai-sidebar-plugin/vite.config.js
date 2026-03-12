import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { copyFile } from "wpsjs/vite_plugins"

const CONFIG_FILE = new URL('./config.local.json', import.meta.url)

async function readLocalConfig() {
    const raw = await readFile(CONFIG_FILE, 'utf8')
    const parsed = JSON.parse(raw)

    if (!parsed.baseUrl || !parsed.apiKey || !parsed.model) {
        throw new Error('config.local.json 缺少 baseUrl、apiKey 或 model')
    }

    return {
        ...parsed,
        temperature: parsed.temperature ?? 0.2,
        maxTokens: parsed.maxTokens ?? 8192
    }
}

function normalizeConfigInput(input, previousConfig) {
    const current = previousConfig || {}
    const baseUrl = String(input.baseUrl || current.baseUrl || '').trim()
    const model = String(input.model || current.model || '').trim()
    const apiKey = String(input.apiKey || current.apiKey || '').trim()
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

                const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': wantsStream ? 'text/event-stream' : 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify(upstreamPayload)
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
                sendJson(res, 500, {
                    error: error.message || String(error)
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
        copyFile({ src: 'manifest.xml', dest: 'manifest.xml', }),
        copyFile({ src: 'js', dest: 'js', }),
        copyFile({ src: 'images', dest: 'images', }),
        copyFile({ src: 'ui', dest: 'ui', }),
        copyFile({ src: 'main.js', dest: 'main.js', }),
        copyFile({ src: 'ribbon.xml', dest: 'ribbon.xml', }),
        copyFile({ src: 'config.example.json', dest: 'config.example.json', }),
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
