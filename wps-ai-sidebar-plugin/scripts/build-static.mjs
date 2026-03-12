import { cp, mkdir, rm } from "node:fs/promises"

const filesToCopy = [
  "config.example.json",
  "index.html",
  "main.js",
  "manifest.xml",
  "ribbon.xml"
]

const dirsToCopy = [
  "images",
  "js",
  "ui"
]

await rm("dist", { recursive: true, force: true })
await mkdir("dist", { recursive: true })

for (const file of filesToCopy) {
  await cp(file, `dist/${file}`)
}

for (const dir of dirsToCopy) {
  await cp(dir, `dist/${dir}`, { recursive: true })
}

console.log("Static build completed in dist/")
