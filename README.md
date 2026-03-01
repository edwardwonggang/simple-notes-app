# 酷炫桌面小工具 (Mac/Windows)

## 功能
- 双击编辑区任意位置，自动复制当前句子到系统剪贴板
- 鼠标右键弹出菜单，点击“一键粘贴”
- 按空格后，后续输入自动切换为另一种颜色
- 窗口支持置顶开关
- 一键清除全部内容

## 运行
1. 安装 Node.js 18+
2. 在项目目录执行：
   ```bash
   npm install
   npm start
   ```

## 说明
- 基于 Electron，兼容 macOS 和 Windows

## 打包安装包
```bash
# macOS (dmg)
npm run dist:mac

# Windows (nsis exe)
npm run dist:win
```

- 输出目录：`dist/`
- 若需同时打包（在当前系统支持范围内）：`npm run dist`

## Windows 一键打包脚本
- 文件：`build-win.bat`
- 用法：在 Windows 上双击 `build-win.bat`
- 脚本会自动执行：
  1. 检查 Node.js
  2. 安装依赖（`npm install`）
  3. 打包 exe（`npm run dist:win`）
