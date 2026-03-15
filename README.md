# AI Markdown Client

一个新的本地桌面 AI 客户端，基于 Electron，支持：

- API URL / API Key / 模型 ID 配置
- 可选代理配置
- 可选忽略 TLS 证书错误
- 本地持久化保存配置
- OpenAI 兼容接口的流式输出
- Markdown 实时渲染到主编辑区
- Mermaid / PlantUML / SVG / HTML 自动渲染

## 运行

```bash
npm install
npm start
```

## 图形渲染依赖

- PlantUML 使用仓库内置的 `plantuml.jar`
- 本地渲染依赖系统安装的 Java 17+ 与 Graphviz
- macOS、Windows 都会按以下顺序查找运行时：
  - 环境变量
  - `PATH`
  - 常见安装目录
- 可选环境变量：
  - `AI_MARKDOWN_JAVA_BIN` 或 `JAVA_HOME`
  - `AI_MARKDOWN_GRAPHVIZ_DOT` 或 `GRAPHVIZ_DOT`

## 打包

```bash
npm run dist:mac
npm run dist:win
```

- 打包后 `plantuml.jar` 会自动从 `asar` 中解包，保证本地 Java 可以正常读取

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
