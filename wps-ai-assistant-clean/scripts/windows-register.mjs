import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const configExample = path.join(projectRoot, "config.example.json")
const configLocal = path.join(projectRoot, "config.local.json")
const packageJsonPath = path.join(projectRoot, "package.json")

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function escapeXml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("\"", "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
}

async function ensureLocalConfig() {
    if (existsSync(configLocal)) {
        return
    }
    await copyFile(configExample, configLocal)
}

function upsert(xml, entry, addonName) {
    const rootMatch = /<jsplugins\b[^>]*>[\s\S]*<\/jsplugins>/i
    const base = rootMatch.test(xml) ? xml : "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<jsplugins>\n</jsplugins>\n"
    const pattern = new RegExp(`<jspluginonline\\b[\\s\\S]*?\\bname=\"${escapeRegExp(escapeXml(addonName))}\"[\\s\\S]*?\\/?>\\s*`, "gi")
    return base.replace(pattern, "").replace(/<\/jsplugins>\s*$/i, `  ${entry}\n</jsplugins>\n`)
}

async function main() {
    if (process.platform !== "win32" && process.env.WPS_PLUGIN_FORCE_WINDOWS !== "1") {
        throw new Error("该脚本仅用于 Windows")
    }
    const appData = process.env.WPS_PLUGIN_APPDATA || process.env.APPDATA
    if (!appData) {
        throw new Error("APPDATA 未设置，无法写入 publish.xml")
    }

    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"))
    const publishXmlPath = path.join(appData, "kingsoft", "wps", "jsaddons", "publish.xml")
    const serverUrl = process.env.WPS_PLUGIN_SERVER_URL || "http://127.0.0.1:3893/"
    const existing = existsSync(publishXmlPath) ? await readFile(publishXmlPath, "utf8") : ""
    const entry = `<jspluginonline name="${escapeXml(packageJson.name)}" type="${escapeXml(packageJson.addonType || "wps")}" url="${escapeXml(serverUrl)}" debug="" enable="enable_dev" install="null"/>`

    await ensureLocalConfig()
    await mkdir(path.dirname(publishXmlPath), { recursive: true })
    await writeFile(publishXmlPath, upsert(existing, entry, packageJson.name), "utf8")
    console.log(`Windows registration file written: ${publishXmlPath}`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})

