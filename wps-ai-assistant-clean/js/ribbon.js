(function registerRibbon(app) {
    const constants = app.core.constants
    const host = app.core.host
    const storage = app.core.storage
    const renderer = app.render.wps

    function syncSelection() {
        const snapshot = host.selectionSnapshot()
        storage.setItem(constants.storageKeys.lastSelection, snapshot.text || "")
        host.ensureTaskPane()
        host.notifyTaskpane(constants.events.selectionUpdated, snapshot)
    }

    function copyLastReply() {
        const lastReply = storage.getItem(constants.storageKeys.lastReply, "")
        if (!lastReply) {
            alert("当前还没有 AI 回复可复制")
            return
        }
        if (!host.copyText(lastReply)) {
            alert("复制失败，请稍后重试")
        }
    }

    function insertLastReply(replaceSelection) {
        const answer = storage.getItem(constants.storageKeys.lastReply, "")
        if (!answer) {
            alert("当前还没有 AI 回复可插入")
            return
        }
        try {
            renderer.writeReplyAtSelection(answer, replaceSelection)
        } catch (error) {
            alert(error && error.message ? error.message : "当前没有可写入的位置，请先把光标放入文档")
            return
        }
        host.notifyTaskpane(constants.events.documentUpdated, {
            mode: replaceSelection ? "replace" : "insert"
        })
    }

    function openInputDebugPane() {
        host.ensureTaskPaneAt(constants.debugTaskpanePath, constants.storageKeys.debugTaskpaneId, 520)
    }

    function scheduleAutoOpen() {
        if (window.__wpsAiAssistantOpened) {
            return
        }
        window.__wpsAiAssistantOpened = true
        window.setTimeout(() => {
            try {
                host.ensureTaskPane()
                syncSelection()
            } catch (_error) {
            }
        }, 260)
    }

    window.OnAddinLoad = function OnAddinLoad(ribbonUi) {
        if (window.Application && typeof window.Application.ribbonUI !== "object") {
            window.Application.ribbonUI = ribbonUi
        }
        host.ensureEnums()
        scheduleAutoOpen()
        return true
    }

    window.OnAction = function OnAction(control) {
        switch (control.Id) {
            case "btnToggleSidebar":
                host.toggleTaskPane()
                break
            case "btnRefreshSelection":
                syncSelection()
                break
            case "btnCopyLastReply":
                copyLastReply()
                break
            case "btnOpenInputDebugPane":
                openInputDebugPane()
                break
            case "btnInsertLastReply":
                insertLastReply(false)
                break
            case "btnReplaceSelection":
                insertLastReply(true)
                break
            default:
                break
        }
        return true
    }

    window.GetImage = function GetImage(control) {
        switch (control.Id) {
            case "btnToggleSidebar":
                return "images/assistant.svg"
            case "btnRefreshSelection":
                return "images/action.svg"
            case "btnOpenInputDebugPane":
                return "images/action.svg"
            default:
                return "images/output.svg"
        }
    }
})(window.WpsAiAssistantClean)
