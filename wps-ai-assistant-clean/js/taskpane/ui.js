(function registerTaskpaneUi(app) {
    const state = app.taskpane.state
    const host = app.core.host

    function byId(id) {
        return document.getElementById(id)
    }

    function editable(node) {
        if (!node || node.disabled) {
            return false
        }
        const tag = node.tagName ? node.tagName.toUpperCase() : ""
        return tag === "TEXTAREA" || tag === "INPUT"
    }

    function bindNativeShortcutIsolation() {
        document.querySelectorAll("input[type='text'], textarea").forEach((node) => {
            node.addEventListener("keydown", (event) => {
                const combo = Boolean((event.ctrlKey || event.metaKey) && !event.altKey)
                const key = String(event.key || "").toLowerCase()
                if (!combo || !["a", "c", "x", "v"].includes(key) || !editable(event.target)) {
                    return
                }
                if (host.isMacDesktop()) {
                    return
                }
                if (typeof event.stopPropagation === "function") {
                    event.stopPropagation()
                }
                event.cancelBubble = true
            })
        })
    }

    function setStatus(text, isError) {
        const node = byId("statusText")
        if (!node) {
            return
        }
        node.textContent = text || ""
        node.classList.toggle("is-error", Boolean(isError))
    }

    function setBusy(busy) {
        const sending = Boolean(busy)
        byId("sendBtn").disabled = sending
        byId("promptInput").disabled = sending
        byId("stopBtn").classList.toggle("hidden", !sending)
        byId("stopBtn").disabled = !sending || !state.activeCancel
    }

    function selectionLabel(lines) {
        if (!lines || !lines.startLine) {
            return ""
        }
        return lines.startLine === lines.endLine
            ? `第 ${lines.startLine} 行`
            : `第 ${lines.startLine}-${lines.endLine} 行`
    }

    function renderSelection() {
        const hint = byId("selectionHint")
        const meta = byId("selectionMeta")
        const lines = selectionLabel(state.selectionLines)

        if (!state.selectionText) {
            hint.textContent = "未读取选区，可直接提问"
            meta.textContent = "当前没有选区上下文"
            return
        }

        hint.textContent = lines ? `已读取选区：${lines}` : "已读取当前选区"
        meta.textContent = `${state.docName ? `${state.docName} · ` : ""}${state.selectionText.slice(0, 100)}${state.selectionText.length > 100 ? "…" : ""}`
    }

    function bind(handlers) {
        bindNativeShortcutIsolation()

        byId("sendBtn").addEventListener("click", () => handlers.submit(byId("promptInput").value))
        byId("stopBtn").addEventListener("click", () => handlers.stop())
        byId("promptInput").addEventListener("keydown", (event) => {
            if (event.isComposing) {
                return
            }
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                handlers.submit(byId("promptInput").value)
            }
        })
    }

    app.taskpane.ui = {
        byId,
        bind,
        setStatus,
        setBusy,
        renderSelection
    }
})(window.WpsAiAssistantClean)
