import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const packageJsonPath = path.join(projectRoot, "package.json")
const configExamplePath = path.join(projectRoot, "config.example.json")
const configLocalPath = path.join(projectRoot, "config.local.json")

function isWindowsRuntime() {
  return process.platform === "win32" || process.env.WPS_PLUGIN_FORCE_WINDOWS === "1"
}

function getAppDataPath() {
  const fromEnv = process.env.WPS_PLUGIN_APPDATA || process.env.APPDATA
  if (!fromEnv) {
    throw new Error("APPDATA is not set, cannot write Windows publish.xml.")
  }
  return fromEnv
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function escapeXmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

async function ensureLocalConfig() {
  if (existsSync(configLocalPath)) {
    return false
  }

  await copyFile(configExamplePath, configLocalPath)
  return true
}

async function readProjectConfig() {
  const raw = await readFile(packageJsonPath, "utf8")
  const parsed = JSON.parse(raw)

  return {
    name: parsed.name || "wps-ai-sidebar-plugin",
    addonType: parsed.addonType || "wps"
  }
}

function upsertPluginEntry(xml, pluginEntry, addonName) {
  const rootMatch = /<jsplugins\b[^>]*>[\s\S]*<\/jsplugins>/i
  const baseXml = rootMatch.test(xml)
    ? xml
    : "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<jsplugins>\n</jsplugins>\n"
  const entryPattern = new RegExp(
    `<jspluginonline\\b[\\s\\S]*?\\bname=\"${escapeRegExp(escapeXmlAttribute(addonName))}\"[\\s\\S]*?\\/?>\\s*`,
    "gi"
  )
  const withoutExistingEntry = baseXml.replace(entryPattern, "")

  return withoutExistingEntry.replace(
    /<\/jsplugins>\s*$/i,
    `  ${pluginEntry}\n</jsplugins>\n`
  )
}

async function main() {
  if (!isWindowsRuntime()) {
    throw new Error("This script is for Windows. Set WPS_PLUGIN_FORCE_WINDOWS=1 if you need to test locally.")
  }

  const { name, addonType } = await readProjectConfig()
  const appData = getAppDataPath()
  const publishXmlPath = path.join(appData, "kingsoft", "wps", "jsaddons", "publish.xml")
  const serverUrl = process.env.WPS_PLUGIN_SERVER_URL || "http://127.0.0.1:3889/"
  const createdConfig = await ensureLocalConfig()

  let existingXml = ""
  if (existsSync(publishXmlPath)) {
    existingXml = await readFile(publishXmlPath, "utf8")
  }

  const pluginEntry = `<jspluginonline name="${escapeXmlAttribute(name)}" type="${escapeXmlAttribute(addonType)}" url="${escapeXmlAttribute(serverUrl)}" debug="" enable="enable_dev" install="null"/>`
  const nextXml = upsertPluginEntry(existingXml, pluginEntry, name)

  await mkdir(path.dirname(publishXmlPath), { recursive: true })
  await writeFile(publishXmlPath, nextXml, "utf8")

  console.log(`Windows registration file written: ${publishXmlPath}`)
  console.log(`Plugin URL: ${serverUrl}`)

  if (createdConfig) {
    console.log(`Created local config: ${configLocalPath}`)
    console.log("Fill in API URL / API Key / model ID, then run the startup script again.")
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
