(function () {
    const state = {
        config: null,
        configSource: "",
        docName: "",
        selectionText: "",
        selectionLines: null,
        useSelection: true,
        configPanelOpen: false,
        busy: false,
        stopRequested: false,
        activeRequestCancel: null,
        messages: [],
        lastReply: "",
        lastError: "",
        pendingRibbonAction: null
    }

    const STORAGE_CHAT_KEY = "wps_ai_sidebar_chat_v1"
    const MAX_AUTO_CONTINUES = 8
    const SELECTION_POLL_MS = 700

    function $id(id) {
        return document.getElementById(id)
    }

    function createMessage(role, content, meta) {
        return {
            id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            role,
            content: meta && meta.preserveWhitespace ? String(content || "") : normalizeText(content),
            streaming: Boolean(meta && meta.streaming),
            selectionChip: meta && meta.selectionChip ? String(meta.selectionChip) : "",
            selectionLabel: meta && meta.selectionLabel ? String(meta.selectionLabel) : ""
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

    function normalizeSelectionLines(value) {
        if (!value) {
            return null
        }

        const startLine = Number(value.startLine)
        const endLine = Number(value.endLine)
        if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine <= 0 || endLine < startLine) {
            return null
        }

        return {
            startLine,
            endLine
        }
    }

    function getSelectionLineLabel(selectionLines) {
        const range = normalizeSelectionLines(selectionLines)
        if (!range) {
            return ""
        }

        if (range.startLine === range.endLine) {
            return `第 ${range.startLine} 行`
        }

        return `第 ${range.startLine} - ${range.endLine} 行`
    }

    function getSelectionChipText(docName, selectionLines) {
        const range = normalizeSelectionLines(selectionLines)
        if (!range) {
            return ""
        }

        const rangeText = range.startLine === range.endLine
            ? `${range.startLine}`
            : `${range.startLine}-${range.endLine}`

        return `(${rangeText})`
    }

    function getSelectionSnapshot() {
        const doc = getActiveDocumentSafe()
        return {
            docName: doc && doc.Name ? doc.Name : "",
            selectionText: getSelectedTextSafe(),
            selectionLines: getSelectionLineRangeSafe()
        }
    }

    function getSelectionSnapshotKey(snapshot) {
        return JSON.stringify({
            docName: snapshot && snapshot.docName || "",
            selectionText: normalizeText(snapshot && snapshot.selectionText || ""),
            selectionLines: normalizeSelectionLines(snapshot && snapshot.selectionLines)
        })
    }

    function applySelectionSnapshot(snapshot) {
        const nextSnapshot = snapshot || {
            docName: "",
            selectionText: "",
            selectionLines: null
        }
        const nextKey = getSelectionSnapshotKey(nextSnapshot)
        const currentKey = getSelectionSnapshotKey({
            docName: state.docName,
            selectionText: state.selectionText,
            selectionLines: state.selectionLines
        })

        if (nextKey === currentKey) {
            return false
        }

        const nextDocName = nextSnapshot.docName || ""
        const nextSelectionText = normalizeText(nextSnapshot.selectionText || "")
        const nextSelectionLines = normalizeSelectionLines(nextSnapshot.selectionLines)
        const shouldPreserveExistingSelection = !nextSelectionText && Boolean(state.selectionText) && nextDocName === state.docName

        state.docName = nextDocName
        if (!shouldPreserveExistingSelection) {
            state.selectionText = nextSelectionText
            state.selectionLines = nextSelectionLines
        }
        setPluginStorageValue("wps_ai_last_selection", state.selectionText)
        renderSelection()
        return true
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
        const stopBtn = $id("stopBtn")
        const input = $id("promptInput")
        const refreshBtn = $id("refreshSelectionBtn")
        const useSelectionBtn = $id("useSelectionBtn")

        if (sendBtn) {
            sendBtn.disabled = busy
            sendBtn.textContent = busy ? "发送中…" : "发送"
        }
        if (stopBtn) {
            stopBtn.classList.toggle("hidden", !busy)
            stopBtn.disabled = !busy || !state.activeRequestCancel
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

        if (!busy) {
            state.stopRequested = false
            setActiveRequestCancel(null)
        }
    }

    function getErrorText(text) {
        if (!text) {
            return "\u7a7a\u54cd\u5e94"
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

    function createAbortError() {
        const error = new Error("Request aborted")
        error.name = "AbortError"
        return error
    }

    function isAbortError(error) {
        if (!error) {
            return false
        }

        return error.name === "AbortError"
            || /abort/i.test(String(error.message || ""))
    }

    function setActiveRequestCancel(cancelFn) {
        state.activeRequestCancel = typeof cancelFn === "function" ? cancelFn : null
        const stopBtn = $id("stopBtn")
        if (stopBtn) {
            stopBtn.disabled = !state.busy || !state.activeRequestCancel
        }
    }

    function stopActiveRequest() {
        if (!state.busy || !state.activeRequestCancel) {
            return
        }

        state.stopRequested = true
        const cancel = state.activeRequestCancel
        setActiveRequestCancel(null)
        setStatus("正在停止生成…", false)

        try {
            cancel()
        } catch (_error) {
        }
    }

    async function requestStream(url, options, handlers) {
        const requestOptions = {
            ...(options || {})
        }
        let controller = null

        try {
            if (typeof AbortController === "function" && !requestOptions.signal) {
                controller = new AbortController()
                requestOptions.signal = controller.signal
            }
            if (handlers && handlers.onRegisterCancel) {
                handlers.onRegisterCancel(controller ? () => controller.abort() : null)
            }

            const response = await fetch(url, requestOptions)
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
            if (isAbortError(fetchError) || (controller && controller.signal && controller.signal.aborted)) {
                throw createAbortError()
            }
            if (!(window.WpsInvoke && typeof window.WpsInvoke.CreateXHR === "function")) {
                throw fetchError
            }

            return await requestStreamByWpsXhr(url, requestOptions, handlers, fetchError)
        } finally {
            if (handlers && handlers.onRegisterCancel) {
                handlers.onRegisterCancel(null)
            }
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
            throw new Error("\u672a\u627e\u5230\u53ef\u7528\u4ee3\u7406\u914d\u7f6e\uff0c\u8bf7\u68c0\u67e5 config.local.json \u5e76\u542f\u52a8\u672c\u5730\u8c03\u8bd5\u670d\u52a1")
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
        state.configSource = "\u672c\u5730\u4ee3\u7406"
        setStatus(`\u5df2\u8fde\u63a5\uff1a${state.configSource} \u00b7 ${state.config.model}`, false)
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
        setConfigStatus("\u6b63\u5728\u4fdd\u5b58\u914d\u7f6e\u2026", false)

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
            state.configSource = "\u672c\u5730\u4ee3\u7406"
            setConfigStatus("\u914d\u7f6e\u5df2\u4fdd\u5b58\uff0c\u4e0b\u6b21\u6253\u5f00\u4f1a\u81ea\u52a8\u8bfb\u53d6\u3002", false)
            setStatus(`\u914d\u7f6e\u5df2\u4fdd\u5b58 \u00b7 \u5f53\u524d\u6a21\u578b\uff1a${state.config.model}`, false)
            setConfigPanelOpen(false)
        } catch (error) {
            setConfigStatus(`\u4fdd\u5b58\u5931\u8d25\uff1a${error.message || error}`, true)
            setStatus(`\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25\uff1a${error.message || error}`, true)
        } finally {
            setBusy(false)
        }
    }

    function readCurrentSelection() {
        const doc = getActiveDocumentSafe()
        state.docName = doc && doc.Name ? doc.Name : ""
        state.selectionText = getSelectedTextSafe()
        state.selectionLines = getSelectionLineRangeSafe()
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

    function readCurrentSelection(options) {
        const settings = options || {}
        const changed = applySelectionSnapshot(getSelectionSnapshot())

        if (settings.silentStatus) {
            return changed
        }

        if (state.selectionText) {
            setStatus(changed ? "\u5df2\u540c\u6b65\u5f53\u524d\u9009\u533a\u3002" : "\u5df2\u8bfb\u53d6\u5f53\u524d\u9009\u533a\u3002", false)
        } else {
            setStatus("\u672a\u8bfb\u53d6\u5230\u9009\u533a\uff0c\u53ef\u76f4\u63a5\u81ea\u7531\u63d0\u95ee\u3002", false)
        }

        return changed
    }

    function startSelectionAutoSync() {
        window.setInterval(() => {
            if (state.configPanelOpen) {
                return
            }
            readCurrentSelection({ silentStatus: true })
        }, SELECTION_POLL_MS)
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
            content: "\u4f60\u662f WPS \u6587\u6863\u4e2d\u7684\u4e2d\u6587\u5199\u4f5c\u52a9\u624b\u3002\u9ed8\u8ba4\u7528\u7b80\u6d01\u3001\u4e13\u4e1a\u7684\u4e2d\u6587\u56de\u7b54\u3002\u5982\u679c\u7528\u6237\u8981\u6c42\u6539\u5199\u3001\u6da6\u8272\u3001\u7ffb\u8bd1\u6216\u751f\u6210\u6587\u7a3f\uff0c\u5728\u6ca1\u6709\u989d\u5916\u8bf4\u660e\u65f6\u53ea\u8f93\u51fa\u6700\u7ec8\u7ed3\u679c\uff0c\u4e0d\u9644\u5e26\u89e3\u91ca\u3002"
        }]

        if (state.useSelection && state.selectionText) {
            const selectionLabel = getSelectionLineLabel(state.selectionLines)
            messages.push({
                role: "system",
                content: `${selectionLabel ? `\u5f53\u524d\u7528\u6237\u5728 WPS \u4e2d\u9009\u4e2d\u4e86 ${selectionLabel} \u7684\u5185\u5bb9\uff0c\u53ef\u4f5c\u4e3a\u4e0a\u4e0b\u6587\u53c2\u8003\uff1a\n` : "\u5f53\u524d\u7528\u6237\u5728 WPS \u4e2d\u9009\u4e2d\u7684\u6587\u672c\u5982\u4e0b\uff0c\u53ef\u4f5c\u4e3a\u4e0a\u4e0b\u6587\u53c2\u8003\uff1a\n"}${state.selectionText}`
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
            throw new Error("????????")
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

                if (handlers && handlers.onRegisterCancel) {
                    handlers.onRegisterCancel(() => {
                        try {
                            xhr.abort()
                        } catch (_error) {
                        }
                    })
                }

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
                    if (xhr.status === 0 && state.stopRequested) {
                        reject(createAbortError())
                        return
                    }
                    reject(new Error(`XHR ${xhr.status}: ${getErrorText(xhr.responseText || fetchError.message)}`))
                }
                xhr.onerror = function () {
                    if (state.stopRequested) {
                        reject(createAbortError())
                        return
                    }
                    reject(fetchError)
                }
                xhr.onabort = function () {
                    reject(createAbortError())
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
        }
        state.selectionLines = normalizeSelectionLines(action.selectionLines)
        renderSelection()

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

        readCurrentSelection({ silentStatus: true })

        const userMessage = createMessage("user", normalizedPrompt, {
            selectionChip: state.useSelection && state.selectionText
                ? getSelectionChipText(state.docName, state.selectionLines)
                : "",
            selectionLabel: state.useSelection && state.selectionText
                ? getSelectionLineLabel(state.selectionLines)
                : ""
        })
        renderMessages()
        setBusy(true)
        setStatus("正在请求 AI…", false)
        state.stopRequested = false
        setActiveRequestCancel(null)

        let documentWriter = null
        let assistantText = ""
        let currentSegmentText = ""
        let promptToSend = normalizedPrompt
        let continueCount = 0
        let streamResult = null

        try {
            documentWriter = createRenderedDocumentTailWriter(normalizedPrompt)

            do {
                currentSegmentText = ""
                streamResult = await callNvidiaChatStream(promptToSend, {
                    onRegisterCancel(cancelFn) {
                        setActiveRequestCancel(cancelFn)
                    },
                    onThinking() {
                        setStatus("模型思考中…", false)
                    },
                    onDelta(fullText, contentPart) {
                        currentSegmentText = fullText || currentSegmentText
                        if (documentWriter) {
                            documentWriter.append(contentPart)
                        }
                        setStatus(continueCount ? `AI 正在续写…（${continueCount}）` : "AI 正在生成…", false)
                    }
                })

                setActiveRequestCancel(null)
                assistantText = mergeContinuationText(assistantText, streamResult && streamResult.text || currentSegmentText || "")

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
            const aborted = state.stopRequested || isAbortError(error)
            const partialText = normalizeText(mergeContinuationText(assistantText, currentSegmentText))

            if (aborted) {
                if (documentWriter) {
                    try {
                        if (documentWriter.hasContent()) {
                            documentWriter.finish()
                        } else {
                            documentWriter.fail("已手动停止")
                        }
                    } catch (_writerError) {
                    }
                }

                state.messages.push(userMessage)
                if (partialText) {
                    state.messages.push(createMessage("assistant", partialText))
                    state.lastReply = partialText
                    setPluginStorageValue("wps_ai_last_reply", partialText)
                }
                renderMessages()
                saveState()
                setStatus(partialText ? "已手动停止，保留已生成内容。" : "已手动停止。", false)
                $id("promptInput").value = ""
            } else {
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
            }
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

    function getDocumentRangeByPosition(start, end) {
        const doc = getActiveDocumentSafe()
        if (!doc || typeof doc.Range !== "function") {
            return null
        }

        try {
            return doc.Range(start, end)
        } catch (_error) {
            return null
        }
    }

    function setRangeText(range, value) {
        if (!range) {
            return
        }

        if (typeof range.Text === "string") {
            range.Text = value
            return
        }

        if (typeof range.InsertAfter === "function") {
            range.InsertAfter(value)
        }
    }

    function collapseRangeToEnd(range) {
        if (range && typeof range.Collapse === "function") {
            range.Collapse(false)
        }
        return range
    }

    function countLeadingSpaces(value) {
        const match = String(value || "").match(/^ */)
        return match ? match[0].length : 0
    }

    function parseInlineMarkdown(text) {
        const value = String(text || "")
        const tokens = []
        let index = 0

        function pushText(fragment) {
            if (!fragment) {
                return
            }
            const previous = tokens[tokens.length - 1]
            if (previous && previous.type === "text") {
                previous.text += fragment
            } else {
                tokens.push({ type: "text", text: fragment })
            }
        }

        while (index < value.length) {
            if (value.startsWith("**", index) || value.startsWith("__", index)) {
                const marker = value.slice(index, index + 2)
                const closeIndex = value.indexOf(marker, index + 2)
                if (closeIndex > index + 2) {
                    tokens.push({
                        type: "strong",
                        children: parseInlineMarkdown(value.slice(index + 2, closeIndex))
                    })
                    index = closeIndex + 2
                    continue
                }
            }

            if (value[index] === "`") {
                const closeIndex = value.indexOf("`", index + 1)
                if (closeIndex > index + 1) {
                    tokens.push({
                        type: "code",
                        text: value.slice(index + 1, closeIndex)
                    })
                    index = closeIndex + 1
                    continue
                }
            }

            if (value[index] === "[") {
                const middleIndex = value.indexOf("](", index + 1)
                const closeIndex = middleIndex >= 0 ? value.indexOf(")", middleIndex + 2) : -1
                if (middleIndex > index + 1 && closeIndex > middleIndex + 2) {
                    tokens.push({
                        type: "link",
                        href: value.slice(middleIndex + 2, closeIndex),
                        children: parseInlineMarkdown(value.slice(index + 1, middleIndex))
                    })
                    index = closeIndex + 1
                    continue
                }
            }

            if (value[index] === "*" || value[index] === "_") {
                const marker = value[index]
                const closeIndex = value.indexOf(marker, index + 1)
                if (closeIndex > index + 1) {
                    tokens.push({
                        type: "em",
                        children: parseInlineMarkdown(value.slice(index + 1, closeIndex))
                    })
                    index = closeIndex + 1
                    continue
                }
            }

            const nextSpecial = value.slice(index + 1).search(/(\*\*|__|`|\[|\*|_)/)
            if (nextSpecial === -1) {
                pushText(value.slice(index))
                break
            }

            pushText(value.slice(index, index + nextSpecial + 1))
            index += nextSpecial + 1
        }

        return tokens
    }

    function inlineTokensToTextAndStyles(tokens, activeStyle, acc) {
        const style = activeStyle || {}
        const output = acc || { text: "", spans: [] }

        ;(tokens || []).forEach((token) => {
            if (!token) {
                return
            }

            if (token.type === "text") {
                const start = output.text.length
                const textValue = token.text || ""
                output.text += textValue
                if (style.bold || style.italic || style.link) {
                    output.spans.push({
                        start,
                        end: output.text.length,
                        bold: style.bold,
                        italic: style.italic,
                        link: style.link
                    })
                }
                return
            }

            if (token.type === "code") {
                const start = output.text.length
                output.text += token.text || ""
                output.spans.push({
                    start,
                    end: output.text.length,
                    code: true
                })
                return
            }

            inlineTokensToTextAndStyles(token.children || [], {
                bold: style.bold || token.type === "strong",
                italic: style.italic || token.type === "em",
                link: style.link || token.type === "link"
            }, output)
        })

        return output
    }

    function parseMarkdownBlocks(text) {
        const lines = normalizeLineBreaks(text || "").split("\n")
        const blocks = []
        let index = 0
        let paragraphLines = []

        function flushParagraph() {
            if (!paragraphLines.length) {
                return
            }

            const textValue = paragraphLines.join(" ").replace(/\s+/g, " ").trim()
            if (textValue) {
                blocks.push({
                    type: "paragraph",
                    tokens: parseInlineMarkdown(textValue)
                })
            }
            paragraphLines = []
        }

        while (index < lines.length) {
            const line = lines[index]
            const trimmed = line.trim()

            if (!trimmed) {
                flushParagraph()
                index += 1
                continue
            }

            if (/^```/.test(trimmed)) {
                flushParagraph()
                index += 1
                const codeLines = []
                while (index < lines.length && !/^```/.test(lines[index].trim())) {
                    codeLines.push(lines[index])
                    index += 1
                }
                if (index < lines.length) {
                    index += 1
                }
                blocks.push({
                    type: "code",
                    text: codeLines.join("\n")
                })
                continue
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
            if (headingMatch) {
                flushParagraph()
                blocks.push({
                    type: "heading",
                    level: headingMatch[1].length,
                    tokens: parseInlineMarkdown(headingMatch[2].trim())
                })
                index += 1
                continue
            }

            if (/^([-*_])(\s*\1){2,}\s*$/.test(trimmed)) {
                flushParagraph()
                blocks.push({ type: "hr" })
                index += 1
                continue
            }

            if (/^>\s?/.test(trimmed)) {
                flushParagraph()
                const quoteLines = []
                while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
                    quoteLines.push(lines[index].trim().replace(/^>\s?/, ""))
                    index += 1
                }
                blocks.push({
                    type: "blockquote",
                    tokens: parseInlineMarkdown(quoteLines.join(" ").trim())
                })
                continue
            }

            const listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/)
            if (listMatch) {
                flushParagraph()
                const ordered = /\d+\./.test(listMatch[2])
                const items = []

                while (index < lines.length) {
                    const currentLine = lines[index]
                    const currentMatch = currentLine.match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/)
                    if (!currentMatch || /\d+\./.test(currentMatch[2]) !== ordered) {
                        break
                    }

                    const level = Math.floor(countLeadingSpaces(currentMatch[1]) / 2)
                    let itemText = currentMatch[3].trim()
                    index += 1

                    while (index < lines.length) {
                        const continuation = lines[index]
                        const continuationTrimmed = continuation.trim()
                        if (!continuationTrimmed) {
                            break
                        }
                        if (/^(\s*)([-+*]|\d+\.)\s+(.+)$/.test(continuation)) {
                            break
                        }
                        if (/^(#{1,6})\s+/.test(continuationTrimmed) || /^>\s?/.test(continuationTrimmed) || /^```/.test(continuationTrimmed)) {
                            break
                        }
                        itemText += ` ${continuationTrimmed}`
                        index += 1
                    }

                    items.push({
                        level,
                        tokens: parseInlineMarkdown(itemText)
                    })
                }

                blocks.push({
                    type: "list",
                    ordered,
                    items
                })
                continue
            }

            paragraphLines.push(trimmed)
            index += 1
        }

        flushParagraph()
        return blocks
    }

    function safeApplyFont(range, updater) {
        if (!range || !range.Font || typeof updater !== "function") {
            return
        }
        try {
            updater(range.Font)
        } catch (_error) {
        }
    }

    function safeApplyParagraphFormat(range, updater) {
        if (!range || !range.ParagraphFormat || typeof updater !== "function") {
            return
        }
        try {
            updater(range.ParagraphFormat)
        } catch (_error) {
        }
    }

    function insertTextAtPosition(position, text) {
        const value = String(text || "")
        if (!value) {
            return null
        }

        const insertionRange = getDocumentRangeByPosition(position, position)
        if (!insertionRange) {
            return null
        }

        if (typeof insertionRange.InsertAfter === "function") {
            insertionRange.InsertAfter(value)
        } else {
            setRangeText(insertionRange, value)
        }

        return getDocumentRangeByPosition(position, position + value.length)
    }

    function applyInlineStyles(baseStart, spans) {
        ;(spans || []).forEach((span) => {
            if (!span || span.end <= span.start) {
                return
            }

            const range = getDocumentRangeByPosition(baseStart + span.start, baseStart + span.end)
            if (!range) {
                return
            }

            if (span.bold) {
                try {
                    range.Bold = 1
                } catch (_error) {
                }
            }
            if (span.italic) {
                try {
                    range.Italic = 1
                } catch (_error) {
                }
            }
            if (span.code) {
                safeApplyFont(range, (font) => {
                    font.Name = "Consolas"
                })
            }
            if (span.link) {
                try {
                    range.Underline = 1
                } catch (_error) {
                }
            }
        })
    }

    function applyHeadingStyle(range, level) {
        const sizeMap = {
            1: 18,
            2: 16,
            3: 14,
            4: 13,
            5: 12,
            6: 11
        }

        try {
            range.Bold = 1
        } catch (_error) {
        }

        safeApplyFont(range, (font) => {
            font.Bold = 1
            font.Size = sizeMap[level] || 12
        })
        safeApplyParagraphFormat(range, (format) => {
            format.SpaceAfter = level <= 2 ? 6 : 3
        })
    }

    function applyParagraphStyle(range) {
        safeApplyParagraphFormat(range, (format) => {
            format.SpaceAfter = 0
        })
    }

    function applyQuoteStyle(range) {
        safeApplyParagraphFormat(range, (format) => {
            format.LeftIndent = 18
            format.SpaceAfter = 0
        })
        try {
            range.Italic = 1
        } catch (_error) {
        }
    }

    function applyCodeBlockStyle(range) {
        safeApplyParagraphFormat(range, (format) => {
            format.LeftIndent = 18
            format.SpaceAfter = 0
        })
        safeApplyFont(range, (font) => {
            font.Name = "Consolas"
        })
    }

    function insertStyledParagraph(position, tokens, blockType, level) {
        const inline = inlineTokensToTextAndStyles(tokens || [])
        const textValue = inline.text || ""
        const insertedRange = insertTextAtPosition(position, `${textValue}\n`)
        if (!insertedRange) {
            return position
        }

        const textRange = getDocumentRangeByPosition(position, position + textValue.length)
        if (textRange) {
            if (blockType === "heading") {
                applyHeadingStyle(textRange, level)
            } else if (blockType === "blockquote") {
                applyQuoteStyle(textRange)
            } else {
                applyParagraphStyle(textRange)
            }
            applyInlineStyles(position, inline.spans)
        }

        return position + textValue.length + 1
    }

    function insertStyledList(position, block) {
        let cursor = position
        const paragraphs = []

        ;(block.items || []).forEach((item) => {
            const inline = inlineTokensToTextAndStyles(item.tokens || [])
            const textValue = inline.text || ""
            const paragraphStart = cursor
            const insertedRange = insertTextAtPosition(cursor, `${textValue}\n`)
            if (!insertedRange) {
                return
            }
            paragraphs.push({
                start: paragraphStart,
                end: paragraphStart + textValue.length,
                level: item.level || 0,
                spans: inline.spans
            })
            cursor += textValue.length + 1
        })

        paragraphs.forEach((paragraph) => {
            const range = getDocumentRangeByPosition(paragraph.start, paragraph.end)
            if (!range) {
                return
            }

            try {
                if (block.ordered) {
                    range.ListFormat.ApplyNumberDefault()
                } else {
                    range.ListFormat.ApplyBulletDefault()
                }
            } catch (_error) {
            }

            for (let levelIndex = 0; levelIndex < paragraph.level; levelIndex += 1) {
                try {
                    range.ListFormat.ListIndent()
                } catch (_error) {
                    break
                }
            }

            applyInlineStyles(paragraph.start, paragraph.spans)
        })

        return cursor
    }

    function insertHorizontalRule(position) {
        const textValue = "────────"
        const insertedRange = insertTextAtPosition(position, `${textValue}\n`)
        if (!insertedRange) {
            return position
        }

        const textRange = getDocumentRangeByPosition(position, position + textValue.length)
        if (textRange) {
            safeApplyFont(textRange, (font) => {
                font.Color = 8421504
            })
        }

        return position + textValue.length + 1
    }

    function insertCodeBlock(position, text) {
        const value = String(text || "")
        const insertedRange = insertTextAtPosition(position, `${value}\n`)
        if (!insertedRange) {
            return position
        }

        const textRange = getDocumentRangeByPosition(position, position + value.length)
        if (textRange) {
            applyCodeBlockStyle(textRange)
        }

        return position + value.length + 1
    }

    function renderMarkdownIntoRange(range, markdownText) {
        const targetRange = range && range.Duplicate ? range.Duplicate : range
        if (!targetRange) {
            throw new Error("当前没有可写入的文档位置，请先打开一个可编辑文档。")
        }

        const start = Number(targetRange.Start)
        const end = Number(targetRange.End)
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            throw new Error("无法定位文档写入范围。")
        }

        const cleanRange = getDocumentRangeByPosition(start, end)
        if (!cleanRange) {
            throw new Error("无法获取文档写入范围。")
        }

        setRangeText(cleanRange, "")

        const blocks = parseMarkdownBlocks(markdownText)
        let cursor = start

        blocks.forEach((block) => {
            if (!block) {
                return
            }

            if (block.type === "heading") {
                cursor = insertStyledParagraph(cursor, block.tokens, "heading", block.level)
                return
            }

            if (block.type === "paragraph") {
                cursor = insertStyledParagraph(cursor, block.tokens, "paragraph")
                return
            }

            if (block.type === "blockquote") {
                cursor = insertStyledParagraph(cursor, block.tokens, "blockquote")
                return
            }

            if (block.type === "list") {
                cursor = insertStyledList(cursor, block)
                return
            }

            if (block.type === "code") {
                cursor = insertCodeBlock(cursor, block.text)
                return
            }

            if (block.type === "hr") {
                cursor = insertHorizontalRule(cursor)
            }
        })

        return {
            start,
            end: cursor
        }
    }

    function getIncrementalMarkdownFlushIndex(markdownText) {
        const value = normalizeLineBreaks(markdownText || "")
        if (!value) {
            return 0
        }

        let index = 0
        let lastFlushIndex = 0
        let inCodeFence = false
        let paragraphOpen = false

        while (index < value.length) {
            const lineEnd = value.indexOf("\n", index)
            if (lineEnd === -1) {
                break
            }

            const nextIndex = lineEnd + 1
            const line = value.slice(index, nextIndex)
            const trimmed = line.trim()

            if (inCodeFence) {
                if (/^```/.test(trimmed)) {
                    inCodeFence = false
                    lastFlushIndex = nextIndex
                }
                index = nextIndex
                continue
            }

            if (/^```/.test(trimmed)) {
                inCodeFence = true
                paragraphOpen = false
                index = nextIndex
                continue
            }

            if (!trimmed) {
                lastFlushIndex = nextIndex
                paragraphOpen = false
                index = nextIndex
                continue
            }

            if (/^(#{1,6})\s+/.test(trimmed) || /^([-*_])(\s*\1){2,}\s*$/.test(trimmed) || /^>\s?/.test(trimmed) || /^(\s*)([-+*]|\d+\.)\s+/.test(line)) {
                lastFlushIndex = nextIndex
                paragraphOpen = false
                index = nextIndex
                continue
            }

            paragraphOpen = true
            index = nextIndex
        }

        return lastFlushIndex
    }

    function createDocumentTailWriter(promptText) {
        return createRenderedDocumentTailWriter(promptText)
    }

    function createRenderedDocumentTailWriter(promptText) {
        const writer = {
            wroteContent: false,
            closed: false,
            markdownBuffer: "",
            responseStart: 0,
            responseEnd: 0
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

        const responseAnchor = getDocumentEndRangeSafe()
        writer.responseStart = responseAnchor ? Number(responseAnchor.Start) : 0
        writer.responseEnd = writer.responseStart

        function renderMarkdownSegment(markdownSegment) {
            const insertionRange = getDocumentRangeByPosition(writer.responseEnd, writer.responseEnd)
            if (!insertionRange) {
                throw new Error("无法获取实时写入区域。")
            }
            const rendered = renderMarkdownIntoRange(insertionRange, markdownSegment)
            writer.responseEnd = rendered.end
        }

        function flushCompletedMarkdown(forceFlush) {
            const flushIndex = forceFlush ? writer.markdownBuffer.length : getIncrementalMarkdownFlushIndex(writer.markdownBuffer)
            if (!flushIndex) {
                return
            }

            const readyMarkdown = writer.markdownBuffer.slice(0, flushIndex)
            writer.markdownBuffer = writer.markdownBuffer.slice(flushIndex)
            if (!readyMarkdown.trim()) {
                return
            }

            renderMarkdownSegment(readyMarkdown)
        }

        return {
            append(text) {
                const value = String(text || "").replace(/\r/g, "")
                if (!value || writer.closed) {
                    return
                }
                writer.markdownBuffer += value
                writer.wroteContent = true
                flushCompletedMarkdown(false)
            },
            flush() {
            },
            finish() {
                if (writer.closed) {
                    return
                }
                flushCompletedMarkdown(true)
                writeTextVisiblyAtDocumentEnd("\n——\n")
                writer.closed = true
            },
            fail(message) {
                if (writer.closed) {
                    return
                }
                flushCompletedMarkdown(true)
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
                renderMarkdownIntoRange(range, value)
                if (typeof range.Select === "function") {
                    range.Select()
                }
            } else {
                const insertionRange = collapseRangeToEnd(range && range.Duplicate ? range.Duplicate : range)
                renderMarkdownIntoRange(insertionRange, value)
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
        bindIfPresent("stopBtn", "click", () => stopActiveRequest())

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
            state.selectionLines = normalizeSelectionLines(event.data.payload && event.data.payload.selectionLines)
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
                        state.selectionLines = normalizeSelectionLines(payload.payload && payload.payload.selectionLines)
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
        startSelectionAutoSync()
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
