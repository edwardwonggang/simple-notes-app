(function registerHost(app) {
    const constants = app.core.constants
    const storage = app.core.storage

    function normalizeText(value) {
        return String(value || "").replace(/\r/g, "").trim()
    }

    function normalizeLineBreaks(value) {
        return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    }

    function getPlatformFingerprint() {
        return `${window.navigator && window.navigator.platform || ""} ${window.navigator && window.navigator.userAgent || ""}`
    }

    function isMacDesktop() {
        return /Mac|Darwin/i.test(getPlatformFingerprint())
    }

    function isWindowsDesktop() {
        return /Win/i.test(getPlatformFingerprint())
    }

    function currentDirectory() {
        const urlText = decodeURI(String(document.location || ""))
        return urlText.slice(0, urlText.lastIndexOf("/"))
    }

    function baseDirectory() {
        return currentDirectory().replace(/\/ui$/, "")
    }

    function viewUrl(relativePath) {
        return `${baseDirectory()}/${String(relativePath || "").replace(/^\//, "")}`
    }

    function ensureEnums() {
        if (window.Application && typeof window.Application.Enum !== "object") {
            window.Application.Enum = {
                msoCTPDockPositionRight: constants.dockRight
            }
        }
    }

    function taskpaneUrl() {
        return viewUrl(constants.taskpanePath)
    }

    function taskpaneWidth() {
        if (isMacDesktop()) {
            return constants.taskpaneWidth.mac
        }
        if (isWindowsDesktop()) {
            return constants.taskpaneWidth.windows
        }
        return constants.taskpaneWidth.fallback
    }

    function setTaskpaneWidth(taskPane, widthOverride) {
        const width = Number(widthOverride) || taskpaneWidth()
        ;[0, 120, 420].forEach((delay) => {
            window.setTimeout(() => {
                try {
                    if (taskPane && "Width" in taskPane) {
                        taskPane.Width = width
                    }
                } catch (_error) {
                }
            }, delay)
        })
    }

    function getTaskPane(storageKey) {
        const key = storageKey || constants.storageKeys.taskpaneId
        const taskPaneId = storage.getItem(key, "")
        if (!taskPaneId) {
            return null
        }
        try {
            return window.Application.GetTaskPane(taskPaneId)
        } catch (_error) {
            return null
        }
    }

    function ensureTaskPaneAt(path, storageKey, widthOverride) {
        ensureEnums()
        let pane = getTaskPane(storageKey)
        if (!pane) {
            pane = window.Application.CreateTaskPane(viewUrl(path))
            storage.setItem(storageKey, pane.ID)
        }
        pane.DockPosition = window.Application.Enum.msoCTPDockPositionRight
        pane.Visible = true
        setTaskpaneWidth(pane, widthOverride)
        return pane
    }

    function ensureTaskPane() {
        return ensureTaskPaneAt(constants.taskpanePath, constants.storageKeys.taskpaneId)
    }

    function toggleTaskPaneAt(path, storageKey, widthOverride) {
        const pane = getTaskPane(storageKey)
        if (!pane) {
            ensureTaskPaneAt(path, storageKey, widthOverride)
            return
        }
        ensureEnums()
        pane.DockPosition = window.Application.Enum.msoCTPDockPositionRight
        pane.Visible = !pane.Visible
        if (pane.Visible) {
            setTaskpaneWidth(pane, widthOverride)
        }
    }

    function toggleTaskPane() {
        toggleTaskPaneAt(constants.taskpanePath, constants.storageKeys.taskpaneId)
    }

    function getActiveDocument() {
        try {
            return window.Application && window.Application.ActiveDocument ? window.Application.ActiveDocument : null
        } catch (_error) {
            return null
        }
    }

    function getSelectionRange() {
        try {
            return window.Application && window.Application.Selection ? window.Application.Selection.Range || null : null
        } catch (_error) {
            return null
        }
    }

    function getSelectionText() {
        const range = getSelectionRange()
        return range ? normalizeText(range.Text || "") : ""
    }

    function getSelectionLines() {
        const range = getSelectionRange()
        if (!range) {
            return null
        }

        try {
            if (typeof range.Information === "function") {
                const startLine = Number(range.Information(10))
                const endLine = Number(range.Information(11))
                if (Number.isFinite(startLine) && Number.isFinite(endLine) && startLine > 0 && endLine >= startLine) {
                    return { startLine, endLine }
                }
            }
        } catch (_error) {
        }

        return null
    }

    function selectionSnapshot() {
        const doc = getActiveDocument()
        return {
            text: getSelectionText(),
            docName: doc && doc.Name ? doc.Name : "",
            selectionLines: getSelectionLines()
        }
    }

    function getDocumentRange(start, end) {
        const doc = getActiveDocument()
        if (!doc || typeof doc.Range !== "function") {
            return null
        }
        try {
            return doc.Range(start, end)
        } catch (_error) {
            return null
        }
    }

    function getDocumentEndRange() {
        const doc = getActiveDocument()
        if (!doc) {
            return null
        }
        try {
            const range = doc.Content && doc.Content.Duplicate ? doc.Content.Duplicate : doc.Range()
            if (!range) {
                return null
            }
            if (typeof range.Collapse === "function") {
                range.Collapse(false)
            }
            return range
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

    function collapseToEnd(range) {
        if (range && typeof range.Collapse === "function") {
            range.Collapse(false)
        }
        return range
    }

    function applyFont(range, updater) {
        if (!range || !range.Font || typeof updater !== "function") {
            return
        }
        try {
            updater(range.Font)
        } catch (_error) {
        }
    }

    function applyParagraph(range, updater) {
        if (!range || !range.ParagraphFormat || typeof updater !== "function") {
            return
        }
        try {
            updater(range.ParagraphFormat)
        } catch (_error) {
        }
    }

    function scrollIntoView(range) {
        if (!range) {
            return
        }
        try {
            if (window.Application && window.Application.ActiveWindow && typeof window.Application.ActiveWindow.ScrollIntoView === "function") {
                window.Application.ActiveWindow.ScrollIntoView(range, true)
            }
        } catch (_error) {
        }
    }

    function moveCursorToEnd() {
        const endRange = getDocumentEndRange()
        if (!endRange) {
            return null
        }
        try {
            if (typeof endRange.Select === "function") {
                endRange.Select()
            }
            scrollIntoView(endRange)
            return window.Application && window.Application.Selection ? window.Application.Selection : null
        } catch (_error) {
            return null
        }
    }

    function appendVisibleText(text) {
        const value = String(text || "")
        if (!value) {
            return false
        }
        const selection = moveCursorToEnd()
        if (selection && typeof selection.TypeText === "function") {
            selection.TypeText(value)
            try {
                if (selection.Range) {
                    scrollIntoView(selection.Range)
                }
            } catch (_error) {
            }
            return true
        }
        const endRange = getDocumentEndRange()
        if (!endRange) {
            return false
        }
        if (typeof endRange.InsertAfter === "function") {
            endRange.InsertAfter(value)
        } else {
            endRange.Text = `${endRange.Text || ""}${value}`
        }
        scrollIntoView(endRange)
        return true
    }

    function writePlainText(text, replaceSelection) {
        const value = String(text || "")
        if (!value) {
            return false
        }
        const range = getSelectionRange()
        if (!range) {
            return false
        }
        try {
            if (replaceSelection) {
                range.Text = value
                if (typeof range.Select === "function") {
                    range.Select()
                }
                return true
            }
            const insertionRange = collapseToEnd(range && range.Duplicate ? range.Duplicate : range)
            if (typeof insertionRange.InsertAfter === "function") {
                insertionRange.InsertAfter(value)
            } else {
                insertionRange.Text = value
            }
            scrollIntoView(insertionRange)
            return true
        } catch (_error) {
            return false
        }
    }

    function copyText(text) {
        const value = normalizeText(text)
        if (!value) {
            return false
        }
        try {
            if (window.Application && window.Application.OAAssist && typeof window.Application.OAAssist.SetClipboardText === "function") {
                window.Application.OAAssist.SetClipboardText(value)
                return true
            }
        } catch (_error) {
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(value).catch(() => {})
                return true
            }
        } catch (_error) {
        }
        return false
    }

    function notifyTaskpane(kind, payload) {
        try {
            if (window.Application && window.Application.OAAssist && typeof window.Application.OAAssist.WebNotify === "function") {
                window.Application.OAAssist.WebNotify(JSON.stringify({ kind, payload }), true)
            }
        } catch (_error) {
        }
    }

    app.core.host = {
        normalizeText,
        normalizeLineBreaks,
        isMacDesktop,
        isWindowsDesktop,
        ensureEnums,
        viewUrl,
        taskpaneUrl,
        getTaskPane,
        ensureTaskPaneAt,
        ensureTaskPane,
        toggleTaskPaneAt,
        toggleTaskPane,
        getActiveDocument,
        getSelectionRange,
        getSelectionText,
        getSelectionLines,
        selectionSnapshot,
        getDocumentRange,
        getDocumentEndRange,
        setRangeText,
        collapseToEnd,
        applyFont,
        applyParagraph,
        scrollIntoView,
        appendVisibleText,
        writePlainText,
        copyText,
        notifyTaskpane
    }
})(window.WpsAiAssistantClean)
