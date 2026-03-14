import { cp, mkdir, rm } from "node:fs/promises"

const files = [
    ".gitignore",
    "README.md",
    "REQUIREMENTS.md",
    "WINDOWS.md",
    "config.example.json",
    "index.html",
    "main.js",
    "manifest.xml",
    "package.json",
    "ribbon.xml",
    "vite.config.js"
]

const dirs = [
    "images",
    "js",
    "scripts",
    "server",
    "ui"
]

await rm("dist", { recursive: true, force: true })
await mkdir("dist", { recursive: true })

for (const file of files) {
    try {
        await cp(file, `dist/${file}`)
    } catch (_error) {
    }
}

for (const dir of dirs) {
    await cp(dir, `dist/${dir}`, { recursive: true })
}

console.log("Static build completed in dist/")

