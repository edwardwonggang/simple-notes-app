import { copyFile, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"

export const CONFIG_FILE = new URL("../config.local.json", import.meta.url)
export const EXAMPLE_FILE = new URL("../config.example.json", import.meta.url)

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

function parseBoolean(value, fallbackValue = false) {
    if (typeof value === "boolean") {
        return value
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (["1", "true", "yes", "on"].includes(normalized)) {
            return true
        }
        if (["0", "false", "no", "off"].includes(normalized)) {
            return false
        }
    }
    return fallbackValue
}

function normalizeConfig(input = {}, previous = {}) {
    return {
        baseUrl: String(input.baseUrl ?? previous.baseUrl ?? "").trim(),
        apiKey: String(input.apiKey ?? previous.apiKey ?? "").trim(),
        model: String(input.model ?? previous.model ?? "").trim(),
        proxyUrl: normalizeProxyUrl(input.proxyUrl ?? previous.proxyUrl ?? ""),
        allowInsecureTls: parseBoolean(input.allowInsecureTls, parseBoolean(previous.allowInsecureTls, false)),
        temperature: Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : (previous.temperature ?? 0.2),
        maxTokens: Number.isFinite(Number(input.maxTokens)) ? Number(input.maxTokens) : (previous.maxTokens ?? 8192)
    }
}

export async function ensureLocalConfig() {
    if (existsSync(CONFIG_FILE)) {
        return false
    }
    await copyFile(EXAMPLE_FILE, CONFIG_FILE)
    return true
}

export async function readLocalConfig() {
    await ensureLocalConfig()
    return normalizeConfig(JSON.parse(await readFile(CONFIG_FILE, "utf8")))
}

export async function writeLocalConfig(input) {
    const previous = existsSync(CONFIG_FILE) ? await readLocalConfig() : normalizeConfig({})
    const next = normalizeConfig(input, previous)
    await writeFile(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8")
    return next
}

export function validateConfig(config) {
    if (!config.baseUrl) {
        throw new Error("请先配置 API URL")
    }
    if (!config.apiKey) {
        throw new Error("请先配置 API Key")
    }
    if (!config.model) {
        throw new Error("请先配置模型 ID")
    }
}

