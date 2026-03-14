import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function main() {
    const appData = process.env.WPS_PLUGIN_APPDATA || process.env.APPDATA
    if (!appData) {
        throw new Error("APPDATA 未设置，无法移除注册")
    }
    const publishXmlPath = path.join(appData, "kingsoft", "wps", "jsaddons", "publish.xml")
    if (!existsSync(publishXmlPath)) {
        console.log("publish.xml 不存在，无需移除")
        return
    }
    const xml = await readFile(publishXmlPath, "utf8")
    const pattern = new RegExp(`<jspluginonline\\b[\\s\\S]*?\\bname=\"${escapeRegExp("wps-ai-assistant-clean")}\"[\\s\\S]*?\\/?>\\s*`, "gi")
    await writeFile(publishXmlPath, xml.replace(pattern, ""), "utf8")
    console.log(`Removed plugin entry from: ${publishXmlPath}`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})

