var WPS_Enum = {
    msoCTPDockPositionLeft: 0,
    msoCTPDockPositionRight: 2
}

function GetUrlPath() {
    let e = document.location.toString()
    return -1 !== (e = decodeURI(e)).indexOf("/") && (e = e.substring(0, e.lastIndexOf("/"))), e
}

function ensureWpsEnums() {
    if (window.Application && typeof window.Application.Enum !== "object") {
        window.Application.Enum = WPS_Enum
    }
}

function getTaskPaneBaseUrl() {
    const current = GetUrlPath()
    return current.replace(/\/ui$/, "")
}

function getPluginStorageValue(key, fallbackValue) {
    try {
        if (!window.Application || !window.Application.PluginStorage) {
            return fallbackValue
        }
        const value = window.Application.PluginStorage.getItem(key)
        return value === undefined || value === null || value === "" ? fallbackValue : value
    } catch (_error) {
        return fallbackValue
    }
}

function setPluginStorageValue(key, value) {
    try {
        if (window.Application && window.Application.PluginStorage) {
            window.Application.PluginStorage.setItem(key, value)
        }
    } catch (_error) {
    }
}

function normalizeText(value) {
    return (value || "").replace(/\r/g, "").trim()
}

function getActiveDocumentSafe() {
    try {
        return window.Application && window.Application.ActiveDocument ? window.Application.ActiveDocument : null
    } catch (_error) {
        return null
    }
}

function getSelectionRangeSafe() {
    try {
        if (!window.Application || !window.Application.Selection) {
            return null
        }
        return window.Application.Selection.Range || null
    } catch (_error) {
        return null
    }
}

function getSelectedTextSafe() {
    const range = getSelectionRangeSafe()
    if (!range) {
        return ""
    }
    return normalizeText(range.Text || "")
}

function normalizeLineBreaks(value) {
    return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function getSelectionLineRangeSafe() {
    const range = getSelectionRangeSafe()
    if (!range) {
        return null
    }

    try {
        if (typeof range.Information === "function") {
            const startLine = Number(range.Information(10))
            const endLine = Number(range.Information(11))
            if (Number.isFinite(startLine) && startLine > 0 && Number.isFinite(endLine) && endLine >= startLine) {
                return {
                    startLine,
                    endLine
                }
            }
        }
    } catch (_error) {
    }

    try {
        const doc = getActiveDocumentSafe()
        const start = Number(range.Start)
        const end = Number(range.End)
        if (!doc || typeof doc.Range !== "function" || !Number.isFinite(start) || !Number.isFinite(end)) {
            return null
        }

        const beforeRange = doc.Range(0, start)
        const beforeText = normalizeLineBreaks(beforeRange && beforeRange.Text || "")
        const selectedText = normalizeLineBreaks(range.Text || "")
        const startLine = beforeText ? beforeText.split("\n").length : 1
        const trimmedSelection = selectedText.replace(/\n+$/, "")
        const selectedLineCount = trimmedSelection ? trimmedSelection.split("\n").length : 1

        return {
            startLine,
            endLine: startLine + selectedLineCount - 1
        }
    } catch (_error) {
        return null
    }
}

function notifyTaskPane(kind, payload) {
    try {
        if (window.Application && window.Application.OAAssist) {
            window.Application.OAAssist.WebNotify(JSON.stringify({ kind, payload }), true)
        }
    } catch (_error) {
    }
}
