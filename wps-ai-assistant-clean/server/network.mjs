import { execFileSync } from "node:child_process"
import { Agent, ProxyAgent } from "undici"

function normalizeProxyUrl(value) {
    const text = String(value || "").trim()
    if (!text) {
        return ""
    }
    if (/^[a-z]+:\/\//i.test(text)) {
        return text
    }
    return `http://${text}`
}

function envProxy(targetUrl) {
    const protocol = new URL(targetUrl).protocol
    const env = process.env
    const candidates = protocol === "https:"
        ? [env.HTTPS_PROXY, env.https_proxy, env.HTTP_PROXY, env.http_proxy, env.ALL_PROXY, env.all_proxy]
        : [env.HTTP_PROXY, env.http_proxy, env.ALL_PROXY, env.all_proxy]
    for (const candidate of candidates) {
        const proxy = normalizeProxyUrl(candidate)
        if (proxy) {
            return proxy
        }
    }
    return ""
}

function registryValue(name) {
    if (process.platform !== "win32") {
        return ""
    }
    try {
        const output = execFileSync(
            "reg",
            ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", name],
            { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
        )
        const line = output.split(/\r?\n/).map((row) => row.trim()).find((row) => row.toLowerCase().startsWith(name.toLowerCase()))
        if (!line) {
            return ""
        }
        const parts = line.split(/\s{2,}/).filter(Boolean)
        return parts[parts.length - 1] || ""
    } catch (_error) {
        return ""
    }
}

function windowsProxy(targetUrl) {
    if (process.platform !== "win32") {
        return ""
    }
    const enabled = registryValue("ProxyEnable")
    if (enabled !== "0x1" && enabled !== "1") {
        return ""
    }
    const server = String(registryValue("ProxyServer") || "").trim()
    if (!server) {
        return ""
    }
    const targetProtocol = new URL(targetUrl).protocol === "https:" ? "https" : "http"
    if (server.includes("=")) {
        const entries = server.split(";").map((item) => item.trim()).filter(Boolean)
        const match = entries.find((item) => item.toLowerCase().startsWith(`${targetProtocol}=`))
            || entries.find((item) => item.toLowerCase().startsWith("http="))
            || entries[0]
        const proxyValue = match.includes("=") ? match.slice(match.indexOf("=") + 1) : match
        return normalizeProxyUrl(proxyValue)
    }
    return normalizeProxyUrl(server)
}

export function resolveProxy(config, targetUrl) {
    return normalizeProxyUrl(config && config.proxyUrl)
        || envProxy(targetUrl)
        || windowsProxy(targetUrl)
}

const dispatchers = new Map()

export function getDispatcher(config, targetUrl) {
    const proxyUrl = resolveProxy(config, targetUrl)
    const allowInsecureTls = Boolean(config && config.allowInsecureTls)
    const key = JSON.stringify({ proxyUrl, allowInsecureTls })
    if (dispatchers.has(key)) {
        return dispatchers.get(key)
    }

    let dispatcher = null
    if (proxyUrl) {
        const tls = allowInsecureTls ? { rejectUnauthorized: false } : undefined
        dispatcher = new ProxyAgent({
            uri: proxyUrl,
            requestTls: tls,
            proxyTls: tls
        })
    } else if (allowInsecureTls) {
        dispatcher = new Agent({
            connect: { rejectUnauthorized: false }
        })
    }
    dispatchers.set(key, dispatcher)
    return dispatcher
}

export function formatError(error) {
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
    return messages.filter(Boolean).join(" | ") || String(error)
}

export function networkHint(error, config, targetUrl) {
    const detail = formatError(error).toLowerCase()
    if (/authorization failed|unauthorized|forbidden|invalid api|401|403/.test(detail)) {
        return "API Key 认证失败，请检查密钥是否完整或是否已失效。"
    }
    if (/self[- ]signed|certificate|unable_to_verify|unable to verify/.test(detail)) {
        return "可能被公司代理替换了 HTTPS 证书，可填写代理 URL；必要时再开启忽略 TLS 证书错误。"
    }
    if (/fetch failed|econnreset|etimedout|enetunreach|ehostunreach|socket hang up|eai_again/.test(detail)) {
        if (resolveProxy(config, targetUrl)) {
            return "请求已走代理，请检查代理地址或代理权限。"
        }
        return "如在公司网络中，请配置代理 URL 后重试。"
    }
    return ""
}

