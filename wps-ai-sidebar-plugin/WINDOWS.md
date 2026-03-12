# Windows 使用说明

这份说明只保留最少步骤。

## 你只需要准备

- 一台已安装 WPS 的 Windows 电脑
- 已安装 Node.js
- 这个插件目录

## 第一次使用

1. 打开插件目录：
   - `/Users/edward/Documents/New project/wps-ai-sidebar-plugin`
2. 在 Windows 电脑里双击：
   - `scripts/windows-start.cmd`
3. 第一次运行后，会自动生成：
   - `config.local.json`
4. 按提示填写这 3 项：
   - `baseUrl`
   - `apiKey`
   - `model`
5. 保存后，再次双击：
   - `scripts/windows-start.cmd`
6. 保持这个命令行窗口不要关闭
7. 打开 WPS，使用右侧插件

## 以后怎么启动

以后每次只要双击一次：

- `scripts/windows-start.cmd`

然后：

- 不要关掉弹出的命令行窗口
- 打开 WPS 使用插件

## 不想用了怎么取消

双击：

- `scripts/windows-unregister.cmd`

## 最重要的两点

- `config.local.json` 只保存在本地电脑
- `config.local.json` 不会提交到 GitHub

## 为什么不能直接丢到 Windows 就用

因为这个插件要通过本地服务转发 AI 请求，这样 API Key 不会暴露到前端页面。
