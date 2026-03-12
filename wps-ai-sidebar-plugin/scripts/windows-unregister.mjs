import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")
const packageJsonPath = path.join(projectRoot, "package.json")

function isWindowsRuntime() {
  return process.platform === "win32" || process.env.WPS_PLUGIN_FORCE_WINDOWS === "1"
}

function getAppDataPath() {
  const fromEnv = process.env.WPS_PLUGIN_APPDATA || process.env.APPDATA
  if (!fromEnv) {
    throw new Error("未找到 APPDATA 环境变量，无法定位 Windows 的 publish.xml")
  }
  return fromEnv
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function readAddonName() {
  const raw = await readFile(packageJsonPath, "utf8")
  const parsed = JSON.parse(raw)
  return parsed.name || "wps-ai-sidebar-plugin"
}

async function main() {
  if (!isWindowsRuntime()) {
    throw new Error("该脚本用于 Windows；如需本机验证，请设置 WPS_PLUGIN_FORCE_WINDOWS=1")
  }

  const addonName = await readAddonName()
  const publishXmlPath = path.join(getAppDataPath(), "kingsoft", "wps", "jsaddons", "publish.xml")

  if (!existsSync(publishXmlPath)) {
    console.log(`未找到注册文件：${publishXmlPath}`)
    return
  }

  const raw = await readFile(publishXmlPath, "utf8")
  const entryPattern = new RegExp(
    `<jspluginonline\\b[\\s\\S]*?\\bname=\"${escapeRegExp(addonName)}\"[\\s\\S]*?\\/?>\\s*`,
    "gi"
  )
  const next = raw.replace(entryPattern, "")

  await writeFile(publishXmlPath, next, "utf8")
  console.log(`已移除 Windows 注册：${publishXmlPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
