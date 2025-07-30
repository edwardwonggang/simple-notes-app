# Augment Code 自动化注册工具 - 完整部署指南

## 📋 系统要求

### 操作系统支持
- ✅ **Linux** (Ubuntu 20.04+, CentOS 7+, Debian 10+)
- ✅ **Windows** (Windows 10+, Windows Server 2019+)
- ✅ **macOS** (macOS 10.15+)

### Python版本
- **Python 3.8+** (推荐 Python 3.10)

## 📦 核心依赖包详情

### requirements.txt 完整内容
```txt
pyperclip==1.8.2
selenium==4.15.2
webdriver-manager==4.0.1
playwright==1.40.0
```

### 依赖包说明
1. **playwright==1.40.0** - 核心浏览器自动化库
   - 大小: ~37MB
   - 功能: 浏览器控制、截图、页面交互
   
2. **selenium==4.15.2** - 备用浏览器自动化库
   - 大小: ~10MB
   - 功能: WebDriver支持
   
3. **pyperclip==1.8.2** - 剪贴板操作
   - 大小: ~20KB
   - 功能: 文本复制粘贴
   
4. **webdriver-manager==4.0.1** - WebDriver管理
   - 大小: ~27KB
   - 功能: 自动下载和管理浏览器驱动

## 🌐 浏览器资源

### Playwright 浏览器下载
Playwright会自动下载以下浏览器：

1. **Chromium 120.0.6099.28**
   - 大小: ~153MB
   - 位置: `~/.cache/ms-playwright/chromium-1091/`
   - 用途: 主要执行浏览器

2. **FFMPEG**
   - 大小: ~2.6MB
   - 位置: `~/.cache/ms-playwright/ffmpeg-1009/`
   - 用途: 视频录制支持

### 系统依赖库 (Linux)
```bash
# Ubuntu/Debian 系统需要的库
libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 
libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 
libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2
```

## 🚀 快速部署步骤

### 1. 环境准备
```bash
# 检查Python版本
python --version  # 应该是 3.8+

# 创建虚拟环境 (推荐)
python -m venv augment_env
source augment_env/bin/activate  # Linux/Mac
# 或
augment_env\Scripts\activate     # Windows
```

### 2. 安装Python依赖
```bash
# 安装核心依赖
pip install -r requirements.txt

# 验证安装
pip list | grep playwright
pip list | grep selenium
```

### 3. 安装Playwright浏览器
```bash
# 安装Chromium浏览器
python -m playwright install chromium

# 安装系统依赖 (Linux)
python -m playwright install-deps

# 验证安装
python -m playwright --version
```

### 4. 验证部署
```bash
# 运行自动化脚本
python augment_playwright_screenshot.py
```

## 📁 必要文件清单

### 核心文件
```
augment_playwright_screenshot.py  # 主要自动化脚本 (569行)
requirements.txt                  # Python依赖列表
DEPLOYMENT_GUIDE.md              # 本部署指南
AUTOMATION_README.md             # 使用说明
```

### 可选文件
```
simple_notes.py                  # 便签程序
README.md                       # 项目说明
run_notes.bat                   # Windows批处理文件
```

## 🔧 离线部署方案

### 1. 下载离线包
```bash
# 下载Python包到本地
pip download -r requirements.txt -d ./offline_packages/

# 离线安装
pip install --no-index --find-links ./offline_packages/ -r requirements.txt
```

### 2. 浏览器离线安装
```bash
# 导出已安装的浏览器
cp -r ~/.cache/ms-playwright/ ./playwright_browsers/

# 在新环境中恢复
cp -r ./playwright_browsers/ ~/.cache/ms-playwright/
```

## 🐳 Docker部署方案

### Dockerfile
```dockerfile
FROM python:3.10-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2

# 设置工作目录
WORKDIR /app

# 复制文件
COPY requirements.txt .
COPY augment_playwright_screenshot.py .

# 安装Python依赖
RUN pip install -r requirements.txt

# 安装Playwright浏览器
RUN python -m playwright install chromium

# 运行脚本
CMD ["python", "augment_playwright_screenshot.py"]
```

### 构建和运行
```bash
# 构建镜像
docker build -t augment-automation .

# 运行容器
docker run -v $(pwd)/screenshots:/app/screenshots augment-automation
```

## 🔍 故障排除

### 常见问题

1. **ModuleNotFoundError: No module named 'playwright'**
   ```bash
   pip install playwright==1.40.0
   ```

2. **Host system is missing dependencies**
   ```bash
   python -m playwright install-deps
   ```

3. **Execution context was destroyed**
   - 网络问题，脚本会自动重试
   - 检查网络连接稳定性

4. **Permission denied**
   ```bash
   chmod +x augment_playwright_screenshot.py
   ```

### 环境验证脚本
```python
# verify_environment.py
import sys
import subprocess

def check_python():
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"❌ Python版本过低: {version.major}.{version.minor}.{version.micro}")
        return False

def check_playwright():
    try:
        import playwright
        print(f"✅ Playwright {playwright.__version__}")
        return True
    except ImportError:
        print("❌ Playwright未安装")
        return False

def check_browser():
    try:
        result = subprocess.run(['python', '-m', 'playwright', '--version'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Playwright浏览器已安装")
            return True
        else:
            print("❌ Playwright浏览器未安装")
            return False
    except:
        print("❌ 无法检查浏览器状态")
        return False

if __name__ == "__main__":
    print("🔍 环境检查中...")
    checks = [check_python(), check_playwright(), check_browser()]
    
    if all(checks):
        print("\n🎉 环境检查通过！可以运行自动化脚本。")
    else:
        print("\n❌ 环境检查失败，请按照部署指南安装缺失组件。")
```

## 📊 资源占用统计

### 磁盘空间
- Python依赖: ~50MB
- Playwright浏览器: ~156MB
- 系统依赖库: ~200MB
- **总计: ~406MB**

### 运行时内存
- 基础Python进程: ~50MB
- Playwright浏览器: ~200-300MB
- **总计: ~250-350MB**

### 网络带宽
- 初始安装下载: ~400MB
- 运行时网络: 最小化使用

## 🎯 性能优化建议

1. **使用虚拟环境** - 避免依赖冲突
2. **定期清理截图** - 避免磁盘空间不足
3. **监控内存使用** - 长时间运行时注意内存泄漏
4. **网络稳定性** - 确保网络连接稳定

## 📞 技术支持

如果遇到部署问题，请检查：
1. Python版本是否符合要求
2. 网络连接是否正常
3. 系统权限是否足够
4. 磁盘空间是否充足

按照本指南操作，可以确保在任何支持的环境中成功部署和运行自动化工具。
