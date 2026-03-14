import { defineConfig } from "vite"

import { createAiProxyMiddleware } from "./server/proxy-middleware.mjs"

export default defineConfig({
    server: {
        host: "127.0.0.1",
        port: 3893
    },
    plugins: [{
        name: "wps-ai-assistant-clean-proxy",
        configureServer(server) {
            server.middlewares.use(createAiProxyMiddleware())
        }
    }]
})

