# Augment Code 自动化注册工具

一个智能的Augment Code注册自动化脚本，具备人机认证处理和迭代重试机制。

## 功能特性

✅ **智能人机认证处理** - 自动检测并处理各种验证码和人机认证  
✅ **SUCCESS!文字检测** - 准确识别注册成功标识  
✅ **模拟人类操作** - 自然的鼠标移动和打字速度  
✅ **自动重试机制** - 最多3次智能重试  
✅ **详细错误处理** - 完整的截图和日志记录  
✅ **多重备用方案** - 支持多种页面访问路径  

## 使用方法

### 1. 安装依赖
```bash
pip install -r requirements.txt
python -m playwright install chromium
python -m playwright install-deps
```

### 2. 运行脚本
```bash
python augment_playwright_screenshot.py
```

### 3. 查看结果
脚本会自动生成详细的截图和HTML文件，记录整个注册过程。

## 输出文件

- `playwright_*_attempt_*.png` - 各步骤的截图
- `playwright_verification_final_attempt_*.html` - 验证页面HTML
- 详细的控制台日志输出

## 执行流程

1. **访问注册页面** - 自动导航到Augment Code注册页面
2. **输入邮箱** - 模拟人类输入邮箱地址
3. **处理人机认证** - 智能检测并处理验证码
4. **检测SUCCESS!** - 识别验证通过标识
5. **跳转验证页面** - 点击continue按钮进入验证码输入页面
6. **完成注册** - 生成完整的执行报告

## 注意事项

- 脚本使用邮箱：`wg824468733wg+123@gmail.com`
- 成功后请检查邮箱验证邮件
- 所有操作都有详细的截图记录
- 支持headless模式运行
- 具备智能重试和错误恢复机制

## 技术实现

- 使用Playwright进行浏览器自动化
- 智能元素定位和交互
- 人机认证自动处理
- 异常恢复和重试机制
- 模拟人类操作行为

## 代码结构

- `augment_playwright_screenshot.py` - 主要的自动化脚本
- `simulate_human_mouse_movement()` - 模拟人类鼠标移动
- `check_and_handle_captcha()` - 人机认证处理
- `execute_signup_flow()` - 主要注册流程
- `find_and_click_continue_to_verification()` - 验证页面跳转

## 成功标准

脚本成功完成的标志：
- 检测到"SUCCESS!"文字
- 成功跳转到验证码输入页面
- 生成完整的截图记录
- 保存验证页面HTML文件

## 故障排除

如果脚本失败，请检查：
1. 网络连接是否正常
2. 依赖是否正确安装
3. 查看错误截图了解具体问题
4. 检查控制台日志输出

脚本具备自动重试功能，会尝试最多3次来完成注册流程。
