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

function notifyTaskPane(kind, payload) {
    try {
        if (window.Application && window.Application.OAAssist) {
            window.Application.OAAssist.WebNotify(JSON.stringify({ kind, payload }), true)
        }
    } catch (_error) {
    }
}
