(function registerStorage(app) {
    function getStorage() {
        try {
            return window.Application && window.Application.PluginStorage ? window.Application.PluginStorage : null
        } catch (_error) {
            return null
        }
    }

    function getItem(key, fallbackValue) {
        const storage = getStorage()
        if (!storage || typeof storage.getItem !== "function") {
            return fallbackValue
        }

        try {
            const value = storage.getItem(key)
            return value === undefined || value === null || value === "" ? fallbackValue : value
        } catch (_error) {
            return fallbackValue
        }
    }

    function setItem(key, value) {
        const storage = getStorage()
        if (!storage || typeof storage.setItem !== "function") {
            return
        }
        try {
            storage.setItem(key, value)
        } catch (_error) {
        }
    }

    function getJson(key, fallbackValue) {
        const raw = getItem(key, "")
        if (!raw) {
            return fallbackValue
        }
        try {
            return JSON.parse(raw)
        } catch (_error) {
            return fallbackValue
        }
    }

    function setJson(key, value) {
        setItem(key, JSON.stringify(value))
    }

    app.core.storage = {
        getItem,
        setItem,
        getJson,
        setJson
    }
})(window.WpsAiAssistantClean)

