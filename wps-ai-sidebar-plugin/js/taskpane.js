(function () {
    const state = {
        config: null,
        configSource: "",
        docName: "",
        selectionText: "",
        useSelection: true,
        configPanelOpen: false,
        busy: false,
        messages: [],
        lastReply: "",
        lastError: "",
        pendingRibbonAction: null
    }

    const STORAGE_CHAT_KEY = "wps_ai_sidebar_chat_v1"
    const MAX_AUTO_CONTINUES = 8

    function $id(id) {
        return document.getElementById(id)
    }

    function createMessage(role, content, meta) {
        return {
            id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            role,
            content: meta && meta.preserveWhitespace ? String(content || "") : normalizeText(content),
            streaming: Boolean(meta && meta.streaming)
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify({
                messages: state.messages.slice(-12),
                lastReply: state.lastReply
            }))
        } catch (_error) {
        }
    }

    function restoreState() {
        try {
            const raw = localStorage.getItem(STORAGE_CHAT_KEY)
            if (!raw) {
                return
            }
            const parsed = JSON.parse(raw)
            state.messages = Array.isArray(parsed.messages) ? parsed.messages : []
            state.lastReply = parsed.lastReply || ""
        } catch (_error) {
        }
    }

    function setStatus(text, isError) {
        const statusText = $id("statusText")
        if (!statusText) {
            return
        }
        statusText.textContent = text
        statusText.style.color = isError ? "#b53939" : "#60708a"
    }

    function renderSelection() {
        const hint = $id("selectionHint")
        const toggle = $id("useSelectionBtn")
        const selectionLength = state.selectionText.length
        const selectionStatus = selectionLength
            ? `${state.useSelection ? "已附带选区" : "已读取选区"} · ${selectionLength} 字${state.docName ? ` · ${state.docName}` : ""}`
            : state.useSelection
                ? "未读取选区，可直接提问"
                : "当前忽略选区，仅进行自由对话"

        if (hint) {
            hint.textContent = selectionStatus
        }
        if (toggle) {
            toggle.classList.toggle("active", state.useSelection)
            toggle.title = state.useSelection ? "附带选区：开" : "附带选区：关"
            toggle.setAttribute("aria-label", toggle.title)
        }
    }

    function setConfigStatus(text, isError) {
        const statusNode = $id("configStatusText")
        if (!statusNode) {
            return
        }
        statusNode.textContent = text
        statusNode.style.color = isError ? "#b53939" : "#66758d"
    }

    function renderConfigForm() {
        const config = state.config || {}
        const baseUrlInput = $id("configBaseUrl")
        const apiKeyInput = $id("configApiKey")
        const modelInput = $id("configModel")
        const maxTokensInput = $id("configMaxTokens")
        const proxyUrlInput = $id("configProxyUrl")
        const allowInsecureTlsInput = $id("configAllowInsecureTls")

        if (baseUrlInput) {
            baseUrlInput.value = config.baseUrl || ""
        }
        if (apiKeyInput) {
            apiKeyInput.value = config.apiKey || ""
        }
        if (modelInput) {
            modelInput.value = config.model || ""
        }
        if (maxTokensInput) {
            maxTokensInput.value = String(config.maxTokens || 8192)
        }
        if (proxyUrlInput) {
            proxyUrlInput.value = config.proxyUrl || ""
        }
        if (allowInsecureTlsInput) {
            allowInsecureTlsInput.checked = Boolean(config.allowInsecureTls)
        }
        setConfigStatus("会自动读取当前配置；公司网络报错时，可补充代理 URL。", false)
    }

    function setConfigPanelOpen(open) {
        state.configPanelOpen = open
        const overlay = $id("configOverlay")
        if (!overlay) {
            return
        }

        overlay.classList.toggle("hidden", !open)
        overlay.setAttribute("aria-hidden", open ? "false" : "true")

        if (open) {
            renderConfigForm()
            const baseUrlInput = $id("configBaseUrl")
            if (baseUrlInput) {
                setTimeout(() => baseUrlInput.focus(), 0)
            }
        } else {
            const promptInput = $id("promptInput")
            if (promptInput) {
                setTimeout(() => promptInput.focus(), 0)
            }
        }
    }

    function renderMessages() {
        const container = $id("messages")
        if (!container) {
            return
        }

        container.innerHTML = ""
        const note = document.createElement("div")
        note.className = "empty-state"
        note.textContent = state.busy
            ? "当前模式：你的问题和 AI 回复会实时写入文档末尾。现在正在逐段输出到文档中…"
            : state.lastReply
                ? "当前模式：问答不会显示在侧栏，而是直接写到文档末尾。最近一次回复已写入文末，可继续提问或用上方按钮复制最近回复。"
                : "当前模式：你的问题和 AI 回复会实时写到文档末尾。侧栏只保留输入框、状态和设置。"
        container.appendChild(note)
    }

    function setBusy(busy) {
        state.busy = busy
        const sendBtn = $id("sendBtn")
        const input = $id("promptInput")
        const refreshBtn = $id("refreshSelectionBtn")
        const useSelectionBtn = $id("useSelectionBtn")

        if (sendBtn) {
            sendBtn.disabled = busy
            sendBtn.textContent = busy ? "发送中…" : "发送"
        }
        if (input) {
            input.disabled = busy
        }
        if (refreshBtn) {
            refreshBtn.disabled = busy
        }
        if (useSelectionBtn) {
            useSelectionBtn.disabled = busy
        }
        document.querySelectorAll("[data-prompt], #copyReplyBtn, #insertReplyBtn, #replaceSelectionBtn, #clearChatBtn, #openConfigBtn, #closeConfigBtn, #cancelConfigBtn, #saveConfigBtn")
            .forEach((button) => {
                button.disabled = busy
            })
    }

    function getErrorText(text) {
        if (!text) {
            return "空响应"
        }

        try {
            const parsed = JSON.parse(text)
            return parsed.error || parsed.message || text
        } catch (_error) {
            return text
        }
    }

    function parseJsonText(text) {
        if (!text) {
            return null
        }
        return JSON.parse(text)
    }

    function getChatRequestConfig(payload) {
        const config = state.config
        if (!config) {
            throw new Error("配置未加载完成")
        }

        const url = config.proxyPath || `${config.baseUrl.replace(/\/$/, "")}/chat/completions`
        const headers = {
            "Content-Type": "application/json"
        }

        if (config.apiKey) {
            headers.Authorization = `Bearer ${config.apiKey}`
        }

        return {
            url,
            options: {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            }
        }
    }

    function createStreamParser(handlers) {
        return {
            buffer: "",
            text: "",
            seenContent: false,
            finishReason: "",
            handlers: handlers || {}
        }
    }

    function mergeContinuationText(previousText, nextText) {
        const existing = String(previousText || "")
        const incoming = String(nextText || "")
        if (!existing) {
            return incoming
        }
        if (!incoming) {
            return existing
        }

        const overlapLimit = Math.min(existing.length, incoming.length, 200)
        for (let size = overlapLimit; size > 0; size -= 1) {
            if (existing.slice(-size) === incoming.slice(0, size)) {
                return existing + incoming.slice(size)
            }
        }

        return existing + incoming
    }

    function extractContentDelta(delta) {
        if (!delta) {
            return ""
        }

        const content = delta.content
        if (typeof content === "string") {
            return content
        }
        if (Array.isArray(content)) {
            return content.map((item) => item.text || item.content || "").join("")
        }
        return ""
    }

    function processStreamEvent(rawEvent, parser) {
        const payload = rawEvent
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
            .trim()

        if (!payload) {
            return
        }
        if (payload === "[DONE]") {
            return
        }

        const json = JSON.parse(payload)
        const choice = json && json.choices && json.choices[0]
        if (!choice) {
            return
        }

        if (choice.finish_reason) {
            parser.finishReason = choice.finish_reason
        }

        const delta = choice.delta || {}
        const contentPart = extractContentDelta(delta)
        if (contentPart) {
            parser.seenContent = true
            parser.text += contentPart
            if (parser.handlers.onDelta) {
                parser.handlers.onDelta(parser.text, contentPart)
            }
            return
        }

        if (!parser.seenContent && (delta.reasoning_content || delta.reasoning) && parser.handlers.onThinking) {
            parser.handlers.onThinking()
        }
    }

    function consumeStreamChunk(text, parser) {
        parser.buffer += String(text || "").replace(/\r/g, "")

        let boundaryIndex = parser.buffer.indexOf("\n\n")
        while (boundaryIndex !== -1) {
            const rawEvent = parser.buffer.slice(0, boundaryIndex)
            parser.buffer = parser.buffer.slice(boundaryIndex + 2)
            processStreamEvent(rawEvent, parser)
            boundaryIndex = parser.buffer.indexOf("\n\n")
        }
    }

    async function requestStream(url, options, handlers) {
        try {
            const response = await fetch(url, options)
            if (!response.ok) {
                const text = await response.text()
                throw new Error(`HTTP ${response.status}: ${getErrorText(text)}`)
            }
            if (!response.body || typeof response.body.getReader !== "function") {
                throw new Error("当前环境不支持流式读取")
            }

            const parser = createStreamParser(handlers)
            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { value, done } = await reader.read()
                if (done) {
                    break
                }
                consumeStreamChunk(decoder.decode(value, { stream: true }), parser)
            }

            consumeStreamChunk(decoder.decode(), parser)
            consumeStreamChunk("\n\n", parser)
            return {
                text: parser.text,
                finishReason: parser.finishReason
            }
        } catch (fetchError) {
            if (!(window.WpsInvoke && typeof window.WpsInvoke.CreateXHR === "function")) {
                throw fetchError
            }

            return await requestStreamByWpsXhr(url, options, handlers, fetchError)
        }
    }

    async function requestJson(url, options) {
        try {
            const response = await fetch(url, options)
            const text = await response.text()

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${getErrorText(text)}`)
            }

            return parseJsonText(text)
        } catch (fetchError) {
            if (!(window.WpsInvoke && typeof window.WpsInvoke.CreateXHR === "function")) {
                throw fetchError
            }

            return await requestByWpsXhr(url, {
                method: options && options.method || "GET",
                headers: options && options.headers || {},
                body: options && options.body || null
            }, fetchError)
        }
    }

    async function loadOptionalDebugSdk() {
        return new Promise((resolve) => {
            const script = document.createElement("script")
            script.src = "../.debugTemp/wpsjsrpcsdk.js"
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.head.appendChild(script)
        })
    }

    async function loadConfig() {
        const config = await requestJson(`/api/config?t=${Date.now()}`, {
            cache: "no-store"
        })

        if (!config || !config.model || !config.proxyPath) {
            throw new Error("未找到可用代理配置，请检查 config.local.json 并使用 npm run debug 启动插件")
        }

        state.config = {
            baseUrl: config.baseUrl || "",
            apiKey: config.apiKey || "",
            model: config.model,
            proxyUrl: config.proxyUrl || "",
            allowInsecureTls: Boolean(config.allowInsecureTls),
            temperature: config.temperature ?? 0.2,
            maxTokens: config.maxTokens ?? 8192,
            proxyPath: config.proxyPath
        }
        state.configSource = "本地代理"
        setStatus(`已连接：${state.configSource} · ${state.config.model}`, false)
    }

    async function saveConfig() {
        const baseUrlInput = $id("configBaseUrl")
        const apiKeyInput = $id("configApiKey")
        const modelInput = $id("configModel")
        const maxTokensInput = $id("configMaxTokens")
        const proxyUrlInput = $id("configProxyUrl")
        const allowInsecureTlsInput = $id("configAllowInsecureTls")
        const payload = {
            baseUrl: normalizeText(baseUrlInput && baseUrlInput.value),
            apiKey: normalizeText(apiKeyInput && apiKeyInput.value),
            model: normalizeText(modelInput && modelInput.value),
            proxyUrl: normalizeText(proxyUrlInput && proxyUrlInput.value),
            allowInsecureTls: Boolean(allowInsecureTlsInput && allowInsecureTlsInput.checked),
            maxTokens: Number(maxTokensInput && maxTokensInput.value) || 8192
        }

        setBusy(true)
        setConfigStatus("正在保存配置…", false)

        try {
            const config = await requestJson("/api/config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })

            state.config = {
                baseUrl: config.baseUrl || "",
                apiKey: config.apiKey || "",
                model: config.model || "",
                proxyUrl: config.proxyUrl || "",
                allowInsecureTls: Boolean(config.allowInsecureTls),
                temperature: config.temperature ?? 0.2,
                maxTokens: config.maxTokens ?? 8192,
                proxyPath: config.proxyPath || "/api/chat"
            }
            state.configSource = "本地代理"
            setConfigStatus("配置已保存，下次打开会自动读取。", false)
            setStatus(`配置已保存 · 当前模型：${state.config.model}`, false)
            setConfigPanelOpen(false)
        } catch (error) {
            setConfigStatus(`保存失败：${error.message || error}`, true)
            setStatus(`配置保存失败：${error.message || error}`, true)
        } finally {
            setBusy(false)
        }
    }

    function readCurrentSelection() {
        const doc = getActiveDocumentSafe()
        state.docName = doc && doc.Name ? doc.Name : ""
        state.selectionText = getSelectedTextSafe()
        setPluginStorageValue("wps_ai_last_selection", state.selectionText)
        renderSelection()

        if (state.selectionText) {
            setStatus("已读取选区。", false)
        } else {
            setStatus("未读取到选区，可直接自由提问。", false)
        }
    }

    function readPendingActionFromStorage() {
        try {
            const raw = getPluginStorageValue("wps_ai_pending_action", "")
            if (!raw) {
                return null
            }
            const parsed = JSON.parse(raw)
            return parsed && parsed.prompt ? parsed : null
        } catch (_error) {
            return null
        }
    }

    function clearPendingActionFromStorage() {
        setPluginStorageValue("wps_ai_pending_action", "")
    }

    function buildMessages(promptText) {
        const history = state.messages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content
        }))

        const messages = [{
            role: "system",
            content: "你是 WPS 文档中的中文写作助手。默认用简洁、专业的中文回答。如果用户要求改写、润色、翻译或生成文稿，在没有额外说明时只输出最终结果，不要附带解释。"
        }]

        if (state.useSelection && state.selectionText) {
            messages.push({
                role: "system",
                content: `当前用户在 WPS 中选中的文本如下，可作为上下文参考：\n${state.selectionText}`
            })
        }

        messages.push(...history)
        messages.push({
            role: "user",
            content: promptText
        })

        return messages
    }

    async function callNvidiaChat(promptText) {
        const config = state.config
        if (!config) {
            throw new Error("配置未加载完成")
        }

        const payload = {
            model: config.model,
            messages: buildMessages(promptText),
            temperature: config.temperature ?? 0.2,
            max_tokens: config.maxTokens ?? 8192,
            extra_body: {
                chat_template_kwargs: {
                    thinking: false
                }
            },
            stream: false
        }

        const requestConfig = getChatRequestConfig(payload)
        return await requestJson(requestConfig.url, requestConfig.options)
    }

    async function callNvidiaChatStream(promptText, handlers) {
        const config = state.config
        if (!config) {
            throw new Error("配置未加载完成")
        }

        const payload = {
            model: config.model,
            messages: buildMessages(promptText),
            temperature: config.temperature ?? 0.2,
            max_tokens: config.maxTokens ?? 8192,
            extra_body: {
                chat_template_kwargs: {
                    thinking: false
                }
            },
            stream: true
        }

        const requestConfig = getChatRequestConfig(payload)
        return await requestStream(requestConfig.url, requestConfig.options, handlers)
    }

    function requestByWpsXhr(url, options, fetchError) {
        return new Promise((resolve, reject) => {
            try {
                const xhr = window.WpsInvoke.CreateXHR()
                const method = options && options.method || "GET"
                const headers = options && options.headers || {}
                xhr.open(method, url)
                Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key]))
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(parseJsonText(xhr.responseText))
                        } catch (parseError) {
                            reject(parseError)
                        }
                        return
                    }
                    reject(new Error(`XHR ${xhr.status}: ${getErrorText(xhr.responseText || fetchError.message)}`))
                }
                xhr.onerror = function () {
                    reject(fetchError)
                }
                xhr.send(options && options.body || null)
            } catch (xhrError) {
                reject(xhrError)
            }
        })
    }

    function requestStreamByWpsXhr(url, options, handlers, fetchError) {
        return new Promise((resolve, reject) => {
            try {
                const xhr = window.WpsInvoke.CreateXHR()
                const method = options && options.method || "GET"
                const headers = options && options.headers || {}
                const parser = createStreamParser(handlers)
                let lastLength = 0

                xhr.open(method, url)
                Object.keys(headers).forEach((key) => xhr.setRequestHeader(key, headers[key]))
                xhr.onprogress = function () {
                    const currentText = xhr.responseText || ""
                    if (currentText.length <= lastLength) {
                        return
                    }
                    const nextText = currentText.slice(lastLength)
                    lastLength = currentText.length
                    consumeStreamChunk(nextText, parser)
                }
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        const trailingText = (xhr.responseText || "").slice(lastLength)
                        if (trailingText) {
                            consumeStreamChunk(trailingText, parser)
                        }
                        consumeStreamChunk("\n\n", parser)
                        resolve({
                            text: parser.text,
                            finishReason: parser.finishReason
                        })
                        return
                    }
                    reject(new Error(`XHR ${xhr.status}: ${getErrorText(xhr.responseText || fetchError.message)}`))
                }
                xhr.onerror = function () {
                    reject(fetchError)
                }
                xhr.send(options && options.body || null)
            } catch (xhrError) {
                reject(xhrError)
            }
        })
    }

    function extractAssistantText(responseJson) {
        const choice = responseJson && responseJson.choices && responseJson.choices[0]
        if (!choice || !choice.message) {
            return ""
        }

        const content = choice.message.content
        if (typeof content === "string") {
            return normalizeText(content)
        }
        if (Array.isArray(content)) {
            return normalizeText(content.map((item) => item.text || item.content || "").join("\n"))
        }
        if (choice.message.reasoning_content) {
            return normalizeText(choice.message.reasoning_content)
        }
        return ""
    }

    async function runQuickAction(action) {
        if (!action || !action.prompt) {
            return
        }

        if (action.docName) {
            state.docName = action.docName
        }
        if (typeof action.selectionText === "string") {
            state.selectionText = normalizeText(action.selectionText)
            renderSelection()
        }

        if (action.requiresSelection && !state.selectionText) {
            setStatus("该快捷动作需要先选中文本。", true)
            alert("请先在 WPS 文档中选中要处理的文本")
            return
        }

        const promptInput = $id("promptInput")
        if (promptInput) {
            promptInput.value = action.prompt
        }

        setStatus(`正在执行：${action.title || "快捷动作"}`, false)
        clearPendingActionFromStorage()
        await submitPrompt(action.prompt)
    }

    async function flushPendingRibbonAction() {
        if (!state.pendingRibbonAction || state.busy || !state.config) {
            return
        }

        const action = state.pendingRibbonAction
        state.pendingRibbonAction = null
        await runQuickAction(action)
    }

    async function submitPrompt(promptText) {
        const normalizedPrompt = normalizeText(promptText)
        if (!normalizedPrompt) {
            alert("请输入问题后再发送")
            return
        }

        readCurrentSelection()

        const userMessage = createMessage("user", normalizedPrompt)
        renderMessages()
        setBusy(true)
        setStatus("正在请求 AI…", false)

        let documentWriter = null
        try {
            documentWriter = createDocumentTailWriter(normalizedPrompt)
            let assistantText = ""
            let promptToSend = normalizedPrompt
            let continueCount = 0
            let streamResult = null

            do {
                streamResult = await callNvidiaChatStream(promptToSend, {
                    onThinking() {
                        setStatus("模型思考中…", false)
                    },
                    onDelta(_fullText, contentPart) {
                        if (documentWriter) {
                            documentWriter.append(contentPart)
                        }
                        setStatus(continueCount ? `AI 正在续写…（${continueCount}）` : "AI 正在生成…", false)
                    }
                })

                assistantText = mergeContinuationText(assistantText, streamResult && streamResult.text || "")

                if (!(streamResult && streamResult.finishReason === "length")) {
                    break
                }

                continueCount += 1
                if (continueCount >= MAX_AUTO_CONTINUES) {
                    break
                }

                setStatus(`达到单次输出上限，正在自动续写…（${continueCount}）`, false)
                promptToSend = "继续上一次回复，从刚才中断处直接续写，不要重复已经输出的内容，不要加标题，不要解释。"
            } while (continueCount < MAX_AUTO_CONTINUES)

            assistantText = normalizeText(assistantText)

            if (!assistantText) {
                setStatus("流式正文为空，正在重试普通输出…", false)
                const responseJson = await callNvidiaChat(normalizedPrompt)
                assistantText = extractAssistantText(responseJson)
                assistantText = normalizeText(assistantText)
                if (assistantText && documentWriter && !documentWriter.hasContent()) {
                    documentWriter.append(assistantText)
                }
            }

            if (!assistantText) {
                throw new Error("模型没有返回可用内容")
            }

            if (documentWriter) {
                documentWriter.finish()
            }

            if (streamResult && streamResult.finishReason === "length") {
                setStatus(`回复已自动续写到上限，当前模型：${state.config.model}`, false)
            }

            state.messages.push(userMessage)
            state.messages.push(createMessage("assistant", assistantText))
            state.lastReply = assistantText
            setPluginStorageValue("wps_ai_last_reply", assistantText)
            renderMessages()
            saveState()
            if (!(streamResult && streamResult.finishReason === "length")) {
                setStatus(`回复完成，模型：${state.config.model}`, false)
            }
            $id("promptInput").value = ""
        } catch (error) {
            if (documentWriter) {
                try {
                    documentWriter.fail(error.message || String(error))
                } catch (_writerError) {
                }
            }
            state.lastError = error.message || String(error)
            state.messages.push(userMessage)
            saveState()
            renderMessages()
            setStatus(`请求失败：${state.lastError}`, true)
            alert(`AI 请求失败：${state.lastError}`)
        } finally {
            setBusy(false)
            if (state.pendingRibbonAction) {
                flushPendingRibbonAction().catch((error) => {
                    setStatus(`快捷动作失败：${error.message || error}`, true)
                })
            }
        }
    }

    function copyText(text) {
        const value = normalizeText(text)
        if (!value) {
            return
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).catch(() => {})
        }

        if (window.Application && window.Application.OAAssist && window.Application.OAAssist.SetClipboardText) {
            try {
                window.Application.OAAssist.SetClipboardText(value)
            } catch (_error) {
            }
        }
    }

    function getDocumentEndRangeSafe() {
        const doc = getActiveDocumentSafe()
        if (!doc) {
            return null
        }

        try {
            const contentRange = doc.Content && doc.Content.Duplicate ? doc.Content.Duplicate : doc.Range()
            if (!contentRange) {
                return null
            }
            if (typeof contentRange.Collapse === "function") {
                contentRange.Collapse(false)
            }
            return contentRange
        } catch (_error) {
            return null
        }
    }

    function appendTextToDocumentEnd(text) {
        const value = String(text || "")
        if (!value) {
            return
        }

        const endRange = getDocumentEndRangeSafe()
        if (!endRange) {
            throw new Error("当前没有可写入的文档位置，请先打开一个可编辑文档")
        }

        if (typeof endRange.InsertAfter === "function") {
            endRange.InsertAfter(value)
            return
        }

        if (typeof endRange.Text === "string") {
            endRange.Text = (endRange.Text || "") + value
            return
        }

        throw new Error("当前文档不支持追加文本")
    }

    function formatNow() {
        const now = new Date()
        const pad = (value) => String(value).padStart(2, "0")
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    }

    function moveSelectionToDocumentEnd() {
        const doc = getActiveDocumentSafe()
        if (!doc) {
            return null
        }

        try {
            const endRange = doc.Content && doc.Content.Duplicate ? doc.Content.Duplicate : doc.Range()
            if (!endRange) {
                return null
            }
            if (typeof endRange.Collapse === "function") {
                endRange.Collapse(false)
            }
            if (typeof endRange.Select === "function") {
                endRange.Select()
            }
            if (window.Application && window.Application.ActiveWindow && typeof window.Application.ActiveWindow.ScrollIntoView === "function") {
                window.Application.ActiveWindow.ScrollIntoView(endRange, true)
            }
            return window.Application && window.Application.Selection ? window.Application.Selection : null
        } catch (_error) {
            return null
        }
    }

    function writeTextVisiblyAtDocumentEnd(text) {
        const value = String(text || "")
        if (!value) {
            return
        }

        const selection = moveSelectionToDocumentEnd()
        if (selection && typeof selection.TypeText === "function") {
            selection.TypeText(value)
            try {
                if (window.Application && window.Application.ActiveWindow && typeof window.Application.ActiveWindow.ScrollIntoView === "function" && selection.Range) {
                    window.Application.ActiveWindow.ScrollIntoView(selection.Range, true)
                }
            } catch (_error) {
            }
            return
        }

        appendTextToDocumentEnd(value)
    }

    function createDocumentTailWriter(promptText) {
        const writer = {
            wroteContent: false,
            closed: false,
            leadingContentPending: true,
            trailingNewlines: 0
        }

        function compactDocumentText(text, options) {
            const value = String(text || "").replace(/\r/g, "")
            const settings = options || {}
            let result = ""

            for (const char of value) {
                if (char === "\n") {
                    if (settings.skipLeadingNewlines && writer.leadingContentPending && !writer.wroteContent) {
                        continue
                    }
                    if (writer.trailingNewlines >= 2) {
                        continue
                    }
                    result += "\n"
                    writer.trailingNewlines += 1
                    continue
                }

                result += char
                writer.trailingNewlines = 0
                writer.leadingContentPending = false
            }

            return result
        }

        const compactPrompt = String(promptText || "")
            .replace(/\r/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        const doc = getActiveDocumentSafe()
        let headerPrefix = "\n"

        try {
            const existingText = doc && doc.Content && typeof doc.Content.Text === "string"
                ? String(doc.Content.Text || "").replace(/\r/g, "").trim()
                : ""
            headerPrefix = existingText ? "\n" : ""
        } catch (_error) {
        }

        writeTextVisiblyAtDocumentEnd(`${headerPrefix}【AI 对话 ${formatNow()}】\n问题：${compactPrompt}\n回答：\n`)

        return {
            append(text) {
                const value = compactDocumentText(text, { skipLeadingNewlines: true })
                if (!value || writer.closed) {
                    return
                }
                writer.wroteContent = true
                writeTextVisiblyAtDocumentEnd(value)
            },
            flush() {
            },
            finish() {
                if (writer.closed) {
                    return
                }
                writeTextVisiblyAtDocumentEnd("\n——\n")
                writer.closed = true
            },
            fail(message) {
                if (writer.closed) {
                    return
                }
                writeTextVisiblyAtDocumentEnd(`\n[输出中断：${message}]\n——\n`)
                writer.closed = true
            },
            hasContent() {
                return writer.wroteContent
            }
        }
    }

    function writeReplyToDocument(text, replaceSelection) {
        const value = normalizeText(text || state.lastReply)
        if (!value) {
            alert("当前没有可写回文档的内容")
            return
        }

        const range = getSelectionRangeSafe()
        if (!range) {
            alert("当前没有可写入的文档位置，请先把光标放入文档")
            return
        }

        try {
            if (replaceSelection) {
                range.Text = value
                if (typeof range.Select === "function") {
                    range.Select()
                }
            } else if (window.Application.Selection && typeof window.Application.Selection.TypeText === "function") {
                window.Application.Selection.TypeText(value)
            } else if (typeof range.Collapse === "function") {
                range.Collapse(false)
                range.Text = value
            } else if (typeof range.InsertAfter === "function") {
                range.InsertAfter(value)
            } else {
                range.Text = (range.Text || "") + value
            }
        } catch (error) {
            alert(`写入文档失败：${error.message || error}`)
            return
        }

        setStatus(replaceSelection ? "已用最近回复替换当前选区。" : "已将最近回复插入到光标处。", false)
        readCurrentSelection()
    }

    function bindUi() {
        const bindIfPresent = (id, eventName, handler) => {
            const element = $id(id)
            if (element) {
                element.addEventListener(eventName, handler)
            }
        }

        bindIfPresent("openConfigBtn", "click", () => setConfigPanelOpen(true))
        bindIfPresent("closeConfigBtn", "click", () => setConfigPanelOpen(false))
        bindIfPresent("cancelConfigBtn", "click", () => setConfigPanelOpen(false))
        bindIfPresent("sendBtn", "click", () => submitPrompt($id("promptInput").value))

        $id("promptInput").addEventListener("keydown", (event) => {
            if (event.isComposing) {
                return
            }
            if (state.configPanelOpen && event.key === "Escape") {
                event.preventDefault()
                setConfigPanelOpen(false)
                return
            }
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                submitPrompt($id("promptInput").value)
            }
        })

        $id("configForm").addEventListener("submit", (event) => {
            event.preventDefault()
            saveConfig()
        })

        $id("configOverlay").addEventListener("click", (event) => {
            const target = event.target
            if (target && target.getAttribute && target.getAttribute("data-config-close") === "true") {
                setConfigPanelOpen(false)
            }
        })

        document.addEventListener("keydown", (event) => {
            if (!state.configPanelOpen || event.key !== "Escape") {
                return
            }
            event.preventDefault()
            setConfigPanelOpen(false)
        })

        document.querySelectorAll("[data-prompt]").forEach((button) => {
            button.addEventListener("click", () => submitPrompt(button.dataset.prompt || ""))
        })

        window.addEventListener("message", (event) => {
            if (!event.data || event.data.kind !== "selection-updated") {
                return
            }
            state.selectionText = normalizeText(event.data.payload && event.data.payload.text || "")
            state.docName = event.data.payload && event.data.payload.docName || state.docName
            renderSelection()
        })
    }

    function registerWebNotifyBridge() {
        if (!(window.WpsInvoke && typeof window.WpsInvoke.RegWebNotify === "function")) {
            return
        }

        try {
            window.WpsInvoke.RegWebNotify("wps", "WpsAiSidebar", function (messageText) {
                try {
                    const payload = JSON.parse(messageText)
                    if (payload.kind === "selection-updated") {
                        state.selectionText = normalizeText(payload.payload && payload.payload.text || "")
                        state.docName = payload.payload && payload.payload.docName || ""
                        renderSelection()
                    }
                    if (payload.kind === "document-updated") {
                        readCurrentSelection()
                    }
                    if (payload.kind === "quick-action") {
                        if (state.busy || !state.config) {
                            state.pendingRibbonAction = payload.payload
                            return
                        }
                        runQuickAction(payload.payload).catch((error) => {
                            setStatus(`快捷动作失败：${error.message || error}`, true)
                        })
                    }
                } catch (_error) {
                }
            })
        } catch (_error) {
        }
    }

    async function init() {
        restoreState()
        renderMessages()
        renderSelection()
        bindUi()
        await loadOptionalDebugSdk()
        registerWebNotifyBridge()
        await loadConfig()
        readCurrentSelection()

        const pendingAction = state.pendingRibbonAction || readPendingActionFromStorage()
        if (pendingAction) {
            state.pendingRibbonAction = null
            await runQuickAction(pendingAction)
        }
    }

    window.onload = function () {
        init().catch((error) => {
            setStatus(`初始化失败：${error.message || error}`, true)
        })
    }
})()
