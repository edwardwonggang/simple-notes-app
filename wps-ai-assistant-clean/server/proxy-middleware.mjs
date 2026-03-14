import { fetch as undiciFetch } from "undici"

import { readLocalConfig, validateConfig, writeLocalConfig } from "./config-store.mjs"
import { formatError, getDispatcher, networkHint } from "./network.mjs"

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(payload))
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on("data", (chunk) => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
        req.on("error", reject)
    })
}

async function pipeStream(upstream, res) {
    res.statusCode = upstream.status
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream; charset=utf-8")
    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    if (typeof res.flushHeaders === "function") {
        res.flushHeaders()
    }
    if (!upstream.body) {
        res.end()
        return
    }
    for await (const chunk of upstream.body) {
        res.write(Buffer.from(chunk))
    }
    res.end()
}

export function createAiProxyMiddleware() {
    return async function aiProxyMiddleware(req, res, next) {
        const method = req.method || "GET"
        const pathname = req.url ? new URL(req.url, "http://localhost").pathname : ""

        if (method === "GET" && pathname === "/api/config") {
            try {
                const config = await readLocalConfig()
                sendJson(res, 200, {
                    ...config,
                    proxyPath: "/api/chat"
                })
            } catch (error) {
                sendJson(res, 500, { error: error.message || String(error) })
            }
            return
        }

        if (method === "POST" && pathname === "/api/config") {
            try {
                const config = await writeLocalConfig(JSON.parse(await readBody(req) || "{}"))
                sendJson(res, 200, {
                    ...config,
                    proxyPath: "/api/chat"
                })
            } catch (error) {
                sendJson(res, 400, { error: error.message || String(error) })
            }
            return
        }

        if (method === "POST" && pathname === "/api/chat") {
            let config = null
            try {
                config = await readLocalConfig()
                validateConfig(config)

                const payload = JSON.parse(await readBody(req) || "{}")
                if (!Array.isArray(payload.messages) || !payload.messages.length) {
                    sendJson(res, 400, { error: "请求缺少 messages" })
                    return
                }

                const wantsStream = Boolean(payload.stream)
                const upstreamPayload = {
                    ...payload,
                    model: payload.model || config.model,
                    temperature: payload.temperature ?? config.temperature,
                    max_tokens: payload.max_tokens ?? config.maxTokens,
                    stream: wantsStream,
                    extra_body: {
                        ...(payload.extra_body || {}),
                        chat_template_kwargs: {
                            ...((payload.extra_body && payload.extra_body.chat_template_kwargs) || {}),
                            thinking: false
                        }
                    }
                }

                const upstreamUrl = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`
                const response = await undiciFetch(upstreamUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": wantsStream ? "text/event-stream" : "application/json",
                        "Authorization": `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify(upstreamPayload),
                    ...(getDispatcher(config, upstreamUrl) ? { dispatcher: getDispatcher(config, upstreamUrl) } : {})
                })

                if (wantsStream) {
                    if (!response.ok) {
                        sendJson(res, response.status, { error: await response.text() || `HTTP ${response.status}` })
                        return
                    }
                    await pipeStream(response, res)
                    return
                }

                const text = await response.text()
                res.statusCode = response.status
                res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8")
                res.end(text)
            } catch (error) {
                const upstreamUrl = config && config.baseUrl ? `${config.baseUrl.replace(/\/$/, "")}/chat/completions` : ""
                const detail = formatError(error)
                const hint = upstreamUrl ? networkHint(error, config, upstreamUrl) : ""
                sendJson(res, 500, {
                    error: hint ? `${detail}。${hint}` : detail
                })
            }
            return
        }

        next()
    }
}

