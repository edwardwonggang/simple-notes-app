(function registerConstants(app) {
    app.core.constants = {
        pluginName: "WpsAiAssistantClean",
        taskpanePath: "ui/taskpane.html",
        debugTaskpanePath: "ui/debug-taskpane.html",
        dockRight: 2,
        storageKeys: {
            taskpaneId: "wps_ai_clean_taskpane_id",
            debugTaskpaneId: "wps_ai_clean_debug_taskpane_id",
            lastReply: "wps_ai_clean_last_reply",
            lastSelection: "wps_ai_clean_last_selection",
            pendingAction: "wps_ai_clean_pending_action"
        },
        events: {
            selectionUpdated: "selection-updated",
            documentUpdated: "document-updated"
        },
        taskpaneWidth: {
            mac: 420,
            windows: 456,
            fallback: 440
        },
        selectionPollMs: 1200,
        maxHistoryTurns: 8,
        maxAutoContinues: 3
    }
})(window.WpsAiAssistantClean)
