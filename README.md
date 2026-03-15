# AI Markdown Client

一个新的本地桌面 AI 客户端，基于 Electron，支持：

- API URL / API Key / 模型 ID 配置
- 可选代理配置
- 可选忽略 TLS 证书错误
- 本地持久化保存配置
- OpenAI 兼容接口的流式输出
- Markdown 实时渲染到主编辑区

## 运行

```bash
npm install
npm start
```

## 打包

```bash
npm run dist:mac
npm run dist:win
```

## 配置

- 配置文件保存在系统本地用户目录中
- 打开应用后可直接在设置面板里修改并保存
- 支持常见 OpenAI 兼容接口，例如 OpenRouter、NVIDIA Integrate 等

## 使用方式

1. 填写 `API URL`、`API Key`、`模型 ID`
2. 如需代理，填写 `代理地址`
3. 点击“保存设置”
4. 在底部输入问题
5. 按 `Cmd/Ctrl + Enter` 或点击“发送”
6. AI 回复会流式写入上方编辑区，并实时进行 Markdown 渲染
