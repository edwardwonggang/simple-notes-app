const QUICK_ACTIONS = {
    btnQuickSummarize: {
        title: "一键总结",
        prompt: "请总结当前选区内容，输出 3-5 条中文要点。",
        requiresSelection: true
    },
    btnQuickPolish: {
        title: "一键润色",
        prompt: "请在保留原意的前提下润色当前选区，使表达更清晰专业。只输出改写后的内容。",
        requiresSelection: true
    },
    btnQuickTranslate: {
        title: "一键翻译",
        prompt: "请将当前选区翻译成英文，保持专业自然。只输出译文。",
        requiresSelection: true
    },
    btnQuickFormalize: {
        title: "正式化",
        prompt: "请把当前选区改写成正式商务语气。只输出改写后的内容。",
        requiresSelection: true
    }
}

function OnAddinLoad(ribbonUI) {
    if (typeof window.Application.ribbonUI !== "object") {
        window.Application.ribbonUI = ribbonUI
    }

    ensureWpsEnums()
    setPluginStorageValue("wps_ai_last_reply", "")
    setPluginStorageValue("wps_ai_last_selection", "")
    scheduleAutoOpenTaskPane()
    return true
}

function getTaskPaneUrl() {
    return GetUrlPath() + "/ui/taskpane.html"
}

function getTaskPaneInstance() {
    const taskPaneId = getPluginStorageValue("wps_ai_taskpane_id", "")
    if (!taskPaneId) {
        return null
    }

    try {
        return window.Application.GetTaskPane(taskPaneId)
    } catch (_error) {
        return null
    }
}

function isMacDesktop() {
    try {
        const fingerprint = `${window.navigator && window.navigator.platform || ""} ${window.navigator && window.navigator.userAgent || ""}`
        return /Mac|Darwin/i.test(fingerprint)
    } catch (_error) {
        return false
    }
}

function getTaskPaneScale() {
    try {
        const scale = Number(window.devicePixelRatio) || 1
        return scale > 0 ? scale : 1
    } catch (_error) {
        return 1
    }
}

function getPreferredTaskPaneWidth() {
    const scale = getTaskPaneScale()
    if (isMacDesktop()) {
        const width = Math.round(560 / scale)
        return Math.max(260, Math.min(340, width))
    }

    const width = Math.round(440 / scale)
    return Math.max(320, Math.min(440, width))
}

function applyTaskPaneWidth(taskPane) {
    const width = getPreferredTaskPaneWidth()
    ;[0, 120, 480].forEach((delay) => {
        setTimeout(() => {
            try {
                if ("Width" in taskPane) {
                    taskPane.Width = width
                }
            } catch (_error) {
            }
        }, delay)
    })
}

function ensureTaskPaneVisible() {
    let taskPane = getTaskPaneInstance()

    if (!taskPane) {
        taskPane = window.Application.CreateTaskPane(getTaskPaneUrl())
        setPluginStorageValue("wps_ai_taskpane_id", taskPane.ID)
    }

    ensureWpsEnums()
    taskPane.DockPosition = window.Application.Enum.msoCTPDockPositionRight

    taskPane.Visible = true
    applyTaskPaneWidth(taskPane)
    return taskPane
}

function scheduleAutoOpenTaskPane() {
    if (window.__wpsAiSidebarAutoOpened) {
        return
    }
    window.__wpsAiSidebarAutoOpened = true

    setTimeout(() => {
        try {
            ensureTaskPaneVisible()
            refreshSelectionSnapshot()
        } catch (_error) {
        }
    }, 240)
}

function toggleTaskPane() {
    const existing = getTaskPaneInstance()
    if (!existing) {
        ensureTaskPaneVisible()
        return
    }

    ensureWpsEnums()
    existing.DockPosition = window.Application.Enum.msoCTPDockPositionRight
    existing.Visible = !existing.Visible
}

function copyLastReply() {
    const value = getPluginStorageValue("wps_ai_last_reply", "")
    if (!value) {
        alert("当前还没有 AI 回复可复制")
        return
    }
    if (window.Application && window.Application.OAAssist && window.Application.OAAssist.SetClipboardText) {
        window.Application.OAAssist.SetClipboardText(value)
        return
    }
    alert("已生成最近回复，请在侧栏中使用复制按钮")
}

function refreshSelectionSnapshot() {
    const selectedText = getSelectedTextSafe()
    setPluginStorageValue("wps_ai_last_selection", selectedText)
    ensureTaskPaneVisible()
    notifyTaskPane("selection-updated", {
        text: selectedText,
        docName: getActiveDocumentSafe() ? getActiveDocumentSafe().Name : ""
    })
}

function triggerQuickAction(controlId) {
    const action = QUICK_ACTIONS[controlId]
    if (!action) {
        return
    }

    const selectedText = getSelectedTextSafe()
    const docName = getActiveDocumentSafe() ? getActiveDocumentSafe().Name : ""

    setPluginStorageValue("wps_ai_last_selection", selectedText)
    setPluginStorageValue("wps_ai_pending_action", JSON.stringify({
        ...action,
        docName,
        selectionText: selectedText
    }))

    ensureTaskPaneVisible()
    notifyTaskPane("selection-updated", {
        text: selectedText,
        docName
    })

    if (action.requiresSelection && !selectedText) {
        alert("请先在文档中选中要处理的文本")
        return
    }

    notifyTaskPane("quick-action", {
        ...action,
        docName,
        selectionText: selectedText
    })
}

function insertLastReply(replaceSelection) {
    const answer = getPluginStorageValue("wps_ai_last_reply", "")
    if (!answer) {
        alert("当前还没有 AI 回复可插入")
        return
    }

    const range = getSelectionRangeSafe()
    if (!range) {
        alert("当前没有可写入的位置，请先将光标放入文档")
        return
    }

    try {
        if (replaceSelection) {
            range.Text = answer
            if (typeof range.Select === "function") {
                range.Select()
            }
        } else if (window.Application.Selection && typeof window.Application.Selection.TypeText === "function") {
            window.Application.Selection.TypeText(answer)
        } else if (typeof range.Collapse === "function") {
            range.Collapse(false)
            range.Text = answer
        } else if (typeof range.InsertAfter === "function") {
            range.InsertAfter(answer)
        } else {
            range.Text = (range.Text || "") + answer
        }
    } catch (error) {
        alert("写入文档失败：" + (error && error.message ? error.message : error))
        return
    }

    notifyTaskPane("document-updated", {
        mode: replaceSelection ? "replace" : "insert"
    })
}

function OnAction(control) {
    switch (control.Id) {
        case "btnToggleSidebar":
            toggleTaskPane()
            break
        case "btnRefreshSelection":
            refreshSelectionSnapshot()
            break
        case "btnCopyLastReply":
            copyLastReply()
            break
        case "btnQuickSummarize":
        case "btnQuickPolish":
        case "btnQuickTranslate":
        case "btnQuickFormalize":
            triggerQuickAction(control.Id)
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

function GetImage(control) {
    switch (control.Id) {
        case "btnToggleSidebar":
            return "images/3.svg"
        case "btnRefreshSelection":
            return "images/2.svg"
        case "btnQuickSummarize":
        case "btnQuickPolish":
        case "btnQuickTranslate":
        case "btnQuickFormalize":
            return "images/1.svg"
        default:
            return "images/newFromTemp.svg"
    }
}
