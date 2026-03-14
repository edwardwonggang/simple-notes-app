(function registerController(app) {
    const constants = app.core.constants
    const host = app.core.host
    const storage = app.core.storage
    const bridge = app.core.bridge
    const renderer = app.render.wps
    const state = app.taskpane.state
    const ui = app.taskpane.ui
    const aiClient = app.taskpane.aiClient

    function buildMessages(promptText) {
        const messages = [{
            role: "system",
            content: "你是 WPS 文档中的中文写作助手。默认输出简洁、专业的中文答案；如用户要求润色、改写、翻译、总结或生成文稿，在没有额外说明时只输出最终结果。"
        }]

        if (state.selectionText) {
            messages.push({
                role: "system",
                content: `当前选区内容可作为上下文参考：\n${state.selectionText}`
            })
        }

        state.history.slice(-constants.maxHistoryTurns * 2).forEach((item) => {
            messages.push({
                role: item.role,
                content: item.content
            })
        })

        messages.push({
            role: "user",
            content: promptText
        })

        return messages
    }

    function payload(promptText, stream) {
        const config = state.config || {}
        return {
            model: config.model,
            messages: buildMessages(promptText),
            temperature: config.temperature ?? 0.2,
            max_tokens: config.maxTokens ?? 8192,
            extra_body: {
                chat_template_kwargs: {
                    thinking: false
                }
            },
            stream: Boolean(stream)
        }
    }

    function syncSelection(silent) {
        const snapshot = host.selectionSnapshot()
        state.selectionText = snapshot.text
        state.selectionLines = snapshot.selectionLines
        state.docName = snapshot.docName
        storage.setItem(constants.storageKeys.lastSelection, snapshot.text || "")
        ui.renderSelection()
        if (!silent) {
            ui.setStatus(snapshot.text ? "已同步当前选区" : "未读取到选区，可直接提问", false)
        }
    }

    function mergeText(previous, next) {
        const left = String(previous || "")
        const right = String(next || "")
        if (!left) {
            return right
        }
        if (!right) {
            return left
        }
        const limit = Math.min(left.length, right.length, 200)
        for (let size = limit; size > 0; size -= 1) {
            if (left.slice(-size) === right.slice(0, size)) {
                return left + right.slice(size)
            }
        }
        return left + right
    }

    function setBusy(busy) {
        state.busy = Boolean(busy)
        ui.setBusy(state.busy)
    }

    function setCancel(cancelFn) {
        state.activeCancel = typeof cancelFn === "function" ? cancelFn : null
        ui.setBusy(state.busy)
    }

    async function loadConfig() {
        const config = await aiClient.loadConfig()
        state.config = {
            baseUrl: config.baseUrl || "",
            apiKey: config.apiKey || "",
            model: config.model || "",
            proxyUrl: config.proxyUrl || "",
            allowInsecureTls: Boolean(config.allowInsecureTls),
            temperature: config.temperature ?? 0.2,
            maxTokens: config.maxTokens ?? 8192
        }
        ui.setStatus(state.config.model ? `已读取本地配置 · ${state.config.model}` : "已读取本地配置", false)
    }

    function stop() {
        if (!state.busy || !state.activeCancel) {
            return
        }
        state.stopRequested = true
        const cancel = state.activeCancel
        setCancel(null)
        ui.setStatus("正在停止生成…", false)
        try {
            cancel()
        } catch (_error) {
        }
    }

    async function submit(promptValue) {
        const promptText = host.normalizeText(promptValue)
        if (!promptText) {
            alert("请输入问题后再发送")
            return
        }

        syncSelection(true)
        setBusy(true)
        setCancel(null)
        state.stopRequested = false
        ui.setStatus("正在请求 AI…", false)

        let writer = null
        let responseText = ""
        let currentSegment = ""
        let segmentPrompt = promptText
        let continueCount = 0
        let streamResult = null

        try {
            writer = renderer.createConversationWriter(promptText)

            do {
                currentSegment = ""
                streamResult = await aiClient.sendChatStream(payload(segmentPrompt, true), {
                    onRegisterCancel(cancelFn) {
                        setCancel(cancelFn)
                    },
                    onDelta(fullText, deltaText) {
                        currentSegment = fullText || currentSegment
                        writer.append(deltaText)
                        ui.setStatus(continueCount ? `AI 正在续写…（${continueCount}）` : "AI 正在生成…", false)
                    }
                })

                setCancel(null)
                responseText = mergeText(responseText, streamResult && streamResult.text || currentSegment || "")

                if (!(streamResult && streamResult.finishReason === "length")) {
                    break
                }

                continueCount += 1
                if (continueCount >= constants.maxAutoContinues) {
                    break
                }
                segmentPrompt = "继续上一次回复，从刚才中断处直接续写，不要重复已经输出的内容，不要解释。"
                ui.setStatus(`达到单次输出上限，正在自动续写…（${continueCount}）`, false)
            } while (continueCount < constants.maxAutoContinues)

            responseText = host.normalizeText(responseText)
            if (!responseText) {
                const fallback = await aiClient.sendChat(payload(promptText, false))
                responseText = aiClient.extractAssistantText(fallback)
                if (responseText && writer && !writer.hasContent()) {
                    writer.append(responseText)
                }
            }

            if (!responseText) {
                throw new Error("模型没有返回可用内容")
            }

            writer.finish()
            state.history.push({ role: "user", content: promptText })
            state.history.push({ role: "assistant", content: responseText })
            state.lastReply = responseText
            storage.setItem(constants.storageKeys.lastReply, responseText)
            ui.byId("promptInput").value = ""
            ui.setStatus("回复完成。", false)
        } catch (error) {
            const aborted = state.stopRequested || aiClient.isAbortError(error)
            const partial = host.normalizeText(mergeText(responseText, currentSegment))

            if (aborted) {
                if (writer) {
                    if (writer.hasContent()) {
                        writer.finish()
                    } else {
                        writer.fail("已手动停止")
                    }
                }
                if (partial) {
                    state.lastReply = partial
                    storage.setItem(constants.storageKeys.lastReply, partial)
                }
                ui.setStatus(partial ? "已手动停止，保留已生成内容。" : "已手动停止。", false)
            } else {
                if (writer) {
                    writer.fail(error.message || String(error))
                }
                ui.setStatus(`请求失败：${error.message || error}`, true)
                alert(`AI 请求失败：${error.message || error}`)
            }
        } finally {
            setBusy(false)
            setCancel(null)
        }
    }

    function writeLastReply(replaceSelection) {
        try {
            renderer.writeReplyAtSelection(storage.getItem(constants.storageKeys.lastReply, ""), replaceSelection)
            ui.setStatus(replaceSelection ? "已替换当前选区" : "已插入回复到光标处", false)
            syncSelection(true)
        } catch (error) {
            alert(error.message || String(error))
        }
    }

    function bindBridge() {
        bridge.register(function onMessage(message) {
            if (!message || !message.kind) {
                return
            }
            if (message.kind === constants.events.selectionUpdated) {
                syncSelection(true)
            }
            if (message.kind === constants.events.documentUpdated) {
                syncSelection(true)
            }
        })
    }

    function startSelectionPolling() {
        window.setInterval(() => {
            if (state.busy) {
                return
            }
            syncSelection(true)
        }, constants.selectionPollMs)
    }

    function initialize() {
        ui.bind({
            submit,
            stop
        })
        bindBridge()
        startSelectionPolling()
        syncSelection(true)
        loadConfig().catch((error) => {
            ui.setStatus(`加载配置失败：${error.message || error}`, true)
        })
    }

    app.taskpane.controller = {
        initialize,
        syncSelection,
        writeLastReply
    }
})(window.WpsAiAssistantClean)
