(function registerBridge(app) {
    function register(handler) {
        if (!(window.WpsInvoke && typeof window.WpsInvoke.RegWebNotify === "function")) {
            return false
        }
        try {
            window.WpsInvoke.RegWebNotify("wps", app.core.constants.pluginName, function onNotify(messageText) {
                try {
                    handler(JSON.parse(messageText))
                } catch (_error) {
                }
            })
            return true
        } catch (_error) {
            return false
        }
    }

    app.core.bridge = {
        register
    }
})(window.WpsAiAssistantClean)

