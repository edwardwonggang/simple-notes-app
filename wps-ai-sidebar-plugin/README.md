# WPS AI 右侧栏插件

一个基于 `wpsjs` 的 WPS 文字加载项，提供极简右侧 AI 输入框，并将问题与流式回答直接写入文档末尾。

## 功能

- WPS 文字右侧任务窗格，自动打开
- 极简 AI 输入框，底部仅保留发送和设置
- 自动读取当前选区作为上下文
- AI 问答直接写入文档末尾
- 支持流式输出、自动续写、较大 `maxTokens`
- 侧栏内可配置 API URL、API Key、模型 ID，并持久化到本地
- 默认使用 NVIDIA Integrate API 的 `stepfun-ai/step-3.5-flash`

## 本地配置

复制 `config.example.json` 为 `config.local.json`，填入你的配置：

```json
{
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "apiKey": "YOUR_API_KEY",
  "model": "stepfun-ai/step-3.5-flash",
  "temperature": 0.2,
  "maxTokens": 2048
}
```

当前工程会在本地开发服务器中读取 `config.local.json`，并通过同源接口 `/api/chat` 代理调用 NVIDIA API。侧栏内也可以直接修改 API URL、API Key、模型 ID、最大输出 Tokens，并持久化写回 `config.local.json`。

`config.local.json` 仅保存在本地，且已被 `.gitignore` 忽略，不会进入构建产物，也不会被提交到 GitHub。

针对 `stepfun-ai/step-3.5-flash`，插件内部默认附带 `extra_body.chat_template_kwargs.thinking=false`，避免模型只输出思考过程。

## 开发

```bash
npm install
npm run debug
```

调试时会启动本地开发服务，并让任务窗格优先请求同源 `/api/config` 与 `/api/chat`。

## 自测

```bash
npm run build
npm run smoke:api
npm run debug:server
```

- `smoke:api`：直接请求 NVIDIA API，验证配置可用
- `debug:server`：只启动 WPS 加载项服务，便于检查静态资源是否正常

## 使用说明

1. 启动 `npm run debug`
2. 打开或新建一个 WPS 文字文档
3. 在 Ribbon 中找到 `AI 写作助手`
4. 点击 `打开侧栏`
5. 在右侧面板中直接提问
6. 问题与 AI 回复会流式写入文档末尾
7. 右下角 `设置` 可修改 `API URL`、`API Key`、`模型 ID` 和 `Max Tokens`

## Windows

Windows 下的最简使用说明见：

- `WINDOWS.md`

公司网络下如果出现 `HTTP: fetch failed`，现在也支持：

- 手动填写 `代理 URL`
- 自动尝试读取 Windows 系统代理
- 必要时临时开启 `忽略 TLS 证书错误`
