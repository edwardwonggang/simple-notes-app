import { readFile } from "node:fs/promises"

const raw = await readFile(new URL("../config.local.json", import.meta.url), "utf8")
const config = JSON.parse(raw)

const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`
  },
  body: JSON.stringify({
    model: config.model,
    temperature: 0,
    max_tokens: 192,
    extra_body: {
      chat_template_kwargs: {
        thinking: false
      }
    },
    stream: false,
    messages: [
      {
        role: "user",
        content: "请只回复：OK"
      }
    ]
  })
})

if (!response.ok) {
  const text = await response.text()
  throw new Error(`NVIDIA API 请求失败：HTTP ${response.status} ${text}`)
}

const json = await response.json()
const message = json?.choices?.[0]?.message ?? {}
const content = message?.content ?? message?.reasoning_content
const output = typeof content === "string" ? content.trim() : JSON.stringify(content)

console.log("API smoke test passed")
console.log(`model=${config.model}`)
console.log(`reply=${output}`)
