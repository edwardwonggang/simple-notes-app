(function registerAiClient(app) {
    function parseJson(text) {
        return text ? JSON.parse(text) : null
    }

    function errorText(text) {
        const value = String(text || "").trim()
        if (!value) {
            return "空响应"
        }
        try {
            const parsed = JSON.parse(value)
            return parsed.error || parsed.detail || parsed.message || value
        } catch (_error) {
            return value
        }
    }

    function createAbortError() {
        const error = new Error("Request aborted")
        error.name = "AbortError"
        return error
    }

    function isAbortError(error) {
        return Boolean(error && (error.name === "AbortError" || /abort/i.test(String(error.message || ""))))
    }

    function createParser(handlers) {
        return {
            buffer: "",
            text: "",
            finishReason: "",
            handlers: handlers || {}
        }
    }

    function extractDelta(choice) {
        const delta = choice && choice.delta ? choice.delta : {}
        if (typeof delta.content === "string") {
            return delta.content
        }
        if (Array.isArray(delta.content)) {
            return delta.content.map((item) => item.text || item.content || "").join("")
        }
        return ""
    }

    function processEvent(raw, parser) {
        const payload = raw
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
            .trim()

        if (!payload || payload === "[DONE]") {
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
        const delta = extractDelta(choice)
        if (!delta) {
            return
        }
        parser.text += delta
        if (parser.handlers.onDelta) {
            parser.handlers.onDelta(parser.text, delta)
        }
    }

    function consumeChunk(text, parser) {
        parser.buffer += String(text || "").replace(/\r/g, "")
        let boundary = parser.buffer.indexOf("\n\n")
        while (boundary !== -1) {
            const raw = parser.buffer.slice(0, boundary)
            parser.buffer = parser.buffer.slice(boundary + 2)
            processEvent(raw, parser)
            boundary = parser.buffer.indexOf("\n\n")
        }
    }

    function requestJsonByXhr(url, options, fetchError) {
        return new Promise((resolve, reject) => {
            try {
                const xhr = window.WpsInvoke.CreateXHR()
                xhr.open(options.method || "GET", url)
                Object.keys(options.headers || {}).forEach((key) => xhr.setRequestHeader(key, options.headers[key]))
                xhr.onreadystatechange = function onStateChange() {
                    if (xhr.readyState !== 4) {
                        return
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(parseJson(xhr.responseText))
                        } catch (parseError) {
                            reject(parseError)
                        }
                        return
                    }
                    reject(new Error(`XHR ${xhr.status}: ${errorText(xhr.responseText || fetchError && fetchError.message)}`))
                }
                xhr.onerror = function onError() {
                    reject(fetchError || new Error("XHR 失败"))
                }
                xhr.send(options.body || null)
            } catch (error) {
                reject(error)
            }
        })
    }

    function requestStreamByXhr(url, options, parserHandlers, fetchError) {
        return new Promise((resolve, reject) => {
            try {
                const xhr = window.WpsInvoke.CreateXHR()
                const parser = createParser(parserHandlers)
                let length = 0

                xhr.open(options.method || "GET", url)
                Object.keys(options.headers || {}).forEach((key) => xhr.setRequestHeader(key, options.headers[key]))

                if (parserHandlers && parserHandlers.onRegisterCancel) {
                    parserHandlers.onRegisterCancel(() => {
                        try {
                            xhr.abort()
                        } catch (_error) {
                        }
                    })
                }

                xhr.onprogress = function onProgress() {
                    const text = xhr.responseText || ""
                    if (text.length <= length) {
                        return
                    }
                    const delta = text.slice(length)
                    length = text.length
                    consumeChunk(delta, parser)
                }

                xhr.onreadystatechange = function onStateChange() {
                    if (xhr.readyState !== 4) {
                        return
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        const remain = (xhr.responseText || "").slice(length)
                        if (remain) {
                            consumeChunk(remain, parser)
                        }
                        consumeChunk("\n\n", parser)
                        resolve({
                            text: parser.text,
                            finishReason: parser.finishReason
                        })
                        return
                    }
                    reject(new Error(`XHR ${xhr.status}: ${errorText(xhr.responseText || fetchError && fetchError.message)}`))
                }

                xhr.onerror = function onError() {
                    reject(fetchError || new Error("XHR 失败"))
                }

                xhr.onabort = function onAbort() {
                    reject(createAbortError())
                }

                xhr.send(options.body || null)
            } catch (error) {
                reject(error)
            }
        })
    }

    async function requestJson(url, options) {
        try {
            const response = await fetch(url, options)
            const text = await response.text()
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${errorText(text)}`)
            }
            return parseJson(text)
        } catch (fetchError) {
            if (!(window.WpsInvoke && typeof window.WpsInvoke.CreateXHR === "function")) {
                throw fetchError
            }
            return requestJsonByXhr(url, {
                method: options && options.method || "GET",
                headers: options && options.headers || {},
                body: options && options.body || null
            }, fetchError)
        }
    }

    async function requestStream(url, options, handlers) {
        const requestOptions = { ...(options || {}) }
        let controller = null
        try {
            if (typeof AbortController === "function") {
                controller = new AbortController()
                requestOptions.signal = controller.signal
            }
            if (handlers && handlers.onRegisterCancel) {
                handlers.onRegisterCancel(controller ? () => controller.abort() : null)
            }
            const response = await fetch(url, requestOptions)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${errorText(await response.text())}`)
            }
            if (!response.body || typeof response.body.getReader !== "function") {
                throw new Error("当前环境不支持流式读取")
            }
            const parser = createParser(handlers)
            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { value, done } = await reader.read()
                if (done) {
                    break
                }
                consumeChunk(decoder.decode(value, { stream: true }), parser)
            }

            consumeChunk(decoder.decode(), parser)
            consumeChunk("\n\n", parser)
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
            return requestStreamByXhr(url, requestOptions, handlers, fetchError)
        } finally {
            if (handlers && handlers.onRegisterCancel) {
                handlers.onRegisterCancel(null)
            }
        }
    }

    function extractAssistantText(payload) {
        const choice = payload && payload.choices && payload.choices[0]
        if (!choice || !choice.message) {
            return ""
        }
        if (typeof choice.message.content === "string") {
            return choice.message.content.trim()
        }
        if (Array.isArray(choice.message.content)) {
            return choice.message.content.map((item) => item.text || item.content || "").join("").trim()
        }
        return ""
    }

    app.taskpane.aiClient = {
        loadConfig() {
            return requestJson(`/api/config?t=${Date.now()}`, { cache: "no-store" })
        },
        saveConfig(payload) {
            return requestJson("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
        },
        sendChat(payload) {
            return requestJson("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
        },
        sendChatStream(payload, handlers) {
            return requestStream("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }, handlers)
        },
        extractAssistantText,
        isAbortError
    }
})(window.WpsAiAssistantClean)
