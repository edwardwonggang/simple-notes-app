(function registerState(app) {
    app.taskpane.state = {
        busy: false,
        stopRequested: false,
        activeCancel: null,
        config: null,
        selectionText: "",
        selectionLines: null,
        docName: "",
        lastReply: "",
        pendingAction: null,
        history: []
    }
})(window.WpsAiAssistantClean)
