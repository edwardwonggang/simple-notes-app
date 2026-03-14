(function registerDebugPage(app) {
    const host = app.core.host
    const state = {
        strategy: "native",
        logLimit: 500,
        entries: [],
        stallTickAt: Date.now()
    }

    function byId(id) {
        return document.getElementById(id)
    }

    function editableTarget(node) {
        if (!node) {
            return false
        }
        const tag = node.tagName ? node.tagName.toUpperCase() : ""
        return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable
    }

    function targetSummary(target) {
        if (!target) {
            return { id: "", tag: "", type: "", valueLength: 0, selection: "" }
        }
        const tag = target.tagName ? target.tagName.toUpperCase() : ""
        const type = target.type || ""
        const textValue = typeof target.value === "string"
            ? target.value
            : (target.isContentEditable ? target.textContent || "" : "")
        let selection = ""
        try {
            if (typeof target.selectionStart === "number" && typeof target.selectionEnd === "number") {
                selection = `${target.selectionStart}-${target.selectionEnd}`
            }
        } catch (_error) {
        }
        return {
            id: target.id || "",
            tag,
            type,
            valueLength: textValue.length,
            selection
        }
    }

    function timestamp() {
        const now = new Date()
        return now.toLocaleTimeString("zh-CN", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`
    }

    function status(text) {
        const node = byId("statusText")
        if (node) {
            node.textContent = text
        }
    }

    function renderLogs() {
        const node = byId("logOutput")
        if (!node) {
            return
        }
        node.textContent = state.entries.join("\n")
        node.scrollTop = node.scrollHeight
    }

    function pushLog(kind, payload) {
        const body = typeof payload === "string" ? payload : JSON.stringify(payload)
        state.entries.push(`[${timestamp()}] ${kind} ${body}`)
        if (state.entries.length > state.logLimit) {
            state.entries.splice(0, state.entries.length - state.logLimit)
        }
        renderLogs()
    }

    function strategyHint() {
        switch (state.strategy) {
            case "stop-propagation":
                return "当前会在 keydown 阶段对组合键调用 stopPropagation。"
            case "stop-immediate":
                return "当前会在 keydown 阶段对组合键调用 stopImmediatePropagation。"
            default:
                return "当前使用原生透传，不主动拦截复制/粘贴组合键。"
        }
    }

    function refreshMeta() {
        byId("platformBadge").textContent = host.isMacDesktop() ? "macOS 宿主" : (host.isWindowsDesktop() ? "Windows 宿主" : "未知平台")
        byId("hostBadge").textContent = window.Application ? "检测到 WPS 宿主" : "浏览器模式"
        byId("strategyHint").textContent = strategyHint()
    }

    function comboKey(event) {
        const key = String(event.key || "").toLowerCase()
        if (!(event.ctrlKey || event.metaKey) || event.altKey) {
            return ""
        }
        return ["a", "c", "v", "x", "z", "y"].includes(key) ? key : ""
    }

    function applyStrategy(event) {
        const key = comboKey(event)
        if (!key || !editableTarget(event.target)) {
            return
        }
        if (state.strategy === "stop-propagation" && typeof event.stopPropagation === "function") {
            event.stopPropagation()
        }
        if (state.strategy === "stop-immediate" && typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation()
        }
    }

    function eventPayload(event) {
        const summary = targetSummary(event.target)
        const payload = {
            target: `${summary.tag}${summary.id ? `#${summary.id}` : ""}${summary.type ? `:${summary.type}` : ""}`,
            valueLength: summary.valueLength
        }
        if (summary.selection) {
            payload.selection = summary.selection
        }
        if (typeof event.key === "string" && event.key) {
            payload.key = event.key
        }
        if (event.type === "keydown" || event.type === "keyup") {
            payload.ctrl = Boolean(event.ctrlKey)
            payload.meta = Boolean(event.metaKey)
            payload.alt = Boolean(event.altKey)
            payload.shift = Boolean(event.shiftKey)
        }
        if (typeof event.inputType === "string" && event.inputType) {
            payload.inputType = event.inputType
        }
        if (typeof event.data === "string" && event.data) {
            payload.dataLength = event.data.length
        }
        try {
            if (event.clipboardData && typeof event.clipboardData.getData === "function") {
                const pastedText = event.clipboardData.getData("text/plain") || ""
                payload.clipboardTextLength = pastedText.length
                if (event.clipboardData.types && event.clipboardData.types.length) {
                    payload.clipboardTypes = Array.from(event.clipboardData.types)
                }
            }
        } catch (_error) {
        }
        return payload
    }

    function bindInput(node) {
        ;["focus", "blur", "keydown", "keyup", "beforeinput", "input", "paste", "copy", "cut", "contextmenu", "compositionstart", "compositionend"].forEach((eventName) => {
            node.addEventListener(eventName, (event) => {
                if (eventName === "keydown") {
                    applyStrategy(event)
                }
                pushLog(eventName, eventPayload(event))
            }, true)
        })
    }

    function bindGlobal() {
        window.addEventListener("error", (event) => {
            pushLog("window.error", {
                message: event.message || "",
                file: event.filename || "",
                line: event.lineno || 0
            })
        })

        window.addEventListener("unhandledrejection", (event) => {
            pushLog("unhandledrejection", {
                reason: event.reason && event.reason.message ? event.reason.message : String(event.reason || "")
            })
        })

        window.setInterval(() => {
            const now = Date.now()
            const drift = now - state.stallTickAt - 500
            state.stallTickAt = now
            if (drift > 220) {
                pushLog("main-thread-stall", { driftMs: drift })
            }
        }, 500)
    }

    function bindUi() {
        byId("strategySelect").addEventListener("change", (event) => {
            state.strategy = event.target.value
            refreshMeta()
            pushLog("strategy-change", { strategy: state.strategy })
        })

        byId("logLimitSelect").addEventListener("change", (event) => {
            state.logLimit = Number(event.target.value) || 500
            pushLog("log-limit-change", { limit: state.logLimit })
        })

        byId("clearLogsBtn").addEventListener("click", () => {
            state.entries = []
            renderLogs()
            status("日志已清空")
        })

        byId("copyLogsBtn").addEventListener("click", () => {
            const payload = state.entries.join("\n")
            const ok = host.copyText(payload)
            status(ok ? "日志已复制" : "复制失败，请手动选中日志")
        })

        byId("markBtn").addEventListener("click", () => {
            pushLog("manual-mark", {
                active: document.activeElement && document.activeElement.id ? document.activeElement.id : ""
            })
            status("已插入标记")
        })
    }

    function init() {
        refreshMeta()
        bindUi()
        bindGlobal()
        ;["probeUrl", "probeApiKey", "probeTextarea", "probeEditable"].forEach((id) => {
            const node = byId(id)
            if (node) {
                bindInput(node)
            }
        })
        pushLog("page-ready", {
            platform: navigator.platform || "",
            userAgent: navigator.userAgent || "",
            hostDetected: Boolean(window.Application)
        })
        status("请直接在这里测试 Cmd/Ctrl 组合键、右键粘贴和长文本粘贴")
    }

    document.addEventListener("DOMContentLoaded", init)
})(window.WpsAiAssistantClean)
