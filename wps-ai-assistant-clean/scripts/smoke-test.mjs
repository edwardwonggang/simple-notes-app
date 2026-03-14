const baseUrl = process.env.WPS_AI_ASSISTANT_BASE_URL || "http://127.0.0.1:3893"

async function main() {
    const configResponse = await fetch(`${baseUrl}/api/config`)
    const config = await configResponse.json()
    console.log("Loaded config:", {
        baseUrl: config.baseUrl,
        model: config.model,
        proxyUrl: config.proxyUrl,
        allowInsecureTls: config.allowInsecureTls
    })

    if (!config.baseUrl || !config.apiKey) {
        console.log("Config incomplete; skipping chat smoke test.")
        return
    }

    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{
                role: "user",
                content: "你好，请只回复测试成功"
            }],
            stream: false
        })
    })

    const text = await chatResponse.text()
    console.log("Chat response:", text)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
