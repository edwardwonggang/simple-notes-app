#!/usr/bin/env python3
"""
环境验证脚本 - 检查Augment Code自动化工具的运行环境
确保所有依赖和资源都正确安装
"""

import sys
import subprocess
import os
import platform
from pathlib import Path

def print_header():
    """打印标题"""
    print("=" * 60)
    print("🔍 Augment Code 自动化工具 - 环境验证")
    print("=" * 60)

def check_python():
    """检查Python版本"""
    print("\n📍 检查Python环境...")
    version = sys.version_info
    
    if version.major >= 3 and version.minor >= 8:
        print(f"✅ Python版本: {version.major}.{version.minor}.{version.micro}")
        print(f"   安装路径: {sys.executable}")
        return True
    else:
        print(f"❌ Python版本过低: {version.major}.{version.minor}.{version.micro}")
        print("   要求: Python 3.8+")
        return False

def check_system_info():
    """检查系统信息"""
    print("\n📍 系统信息...")
    print(f"✅ 操作系统: {platform.system()} {platform.release()}")
    print(f"✅ 架构: {platform.machine()}")
    print(f"✅ 处理器: {platform.processor()}")

def check_required_packages():
    """检查必需的Python包"""
    print("\n📍 检查Python依赖包...")
    
    required_packages = {
        'playwright': '1.40.0',
        'selenium': '4.15.2',
        'pyperclip': '1.8.2',
        'webdriver_manager': '4.0.1'
    }
    
    all_installed = True
    
    for package, expected_version in required_packages.items():
        try:
            if package == 'webdriver_manager':
                import webdriver_manager
                version = webdriver_manager.__version__
                package_name = 'webdriver-manager'
            else:
                module = __import__(package)
                version = getattr(module, '__version__', 'unknown')
                package_name = package
            
            print(f"✅ {package_name}: {version}")
            
            # 检查版本是否匹配
            if version != expected_version and version != 'unknown':
                print(f"   ⚠️ 期望版本: {expected_version}")
                
        except ImportError:
            print(f"❌ {package}: 未安装")
            all_installed = False
    
    return all_installed

def check_playwright_browser():
    """检查Playwright浏览器"""
    print("\n📍 检查Playwright浏览器...")
    
    try:
        # 检查Playwright版本
        result = subprocess.run(['python', '-m', 'playwright', '--version'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print(f"✅ Playwright CLI: {result.stdout.strip()}")
        else:
            print("❌ Playwright CLI无法运行")
            return False
            
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print("❌ Playwright CLI无法访问")
        return False
    
    # 检查浏览器安装
    try:
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            # 检查Chromium
            try:
                browser = p.chromium.launch(headless=True)
                print("✅ Chromium浏览器: 已安装并可用")
                browser.close()
                return True
            except Exception as e:
                print(f"❌ Chromium浏览器: 无法启动 - {str(e)}")
                return False
                
    except ImportError:
        print("❌ 无法导入Playwright")
        return False

def check_browser_cache():
    """检查浏览器缓存目录"""
    print("\n📍 检查浏览器缓存...")
    
    # 常见的Playwright缓存路径
    cache_paths = [
        Path.home() / '.cache' / 'ms-playwright',
        Path.home() / 'Library' / 'Caches' / 'ms-playwright',  # macOS
        Path.home() / 'AppData' / 'Local' / 'ms-playwright'    # Windows
    ]
    
    for cache_path in cache_paths:
        if cache_path.exists():
            print(f"✅ 浏览器缓存目录: {cache_path}")
            
            # 检查Chromium
            chromium_dirs = list(cache_path.glob('chromium-*'))
            if chromium_dirs:
                for chromium_dir in chromium_dirs:
                    size = sum(f.stat().st_size for f in chromium_dir.rglob('*') if f.is_file())
                    size_mb = size / (1024 * 1024)
                    print(f"   📁 {chromium_dir.name}: {size_mb:.1f} MB")
            else:
                print("   ⚠️ 未找到Chromium浏览器文件")
            
            return True
    
    print("❌ 未找到浏览器缓存目录")
    return False

def check_core_files():
    """检查核心文件"""
    print("\n📍 检查核心文件...")
    
    required_files = [
        'augment_playwright_screenshot.py',
        'requirements.txt'
    ]
    
    all_present = True
    
    for filename in required_files:
        if os.path.exists(filename):
            size = os.path.getsize(filename)
            print(f"✅ {filename}: {size} bytes")
        else:
            print(f"❌ {filename}: 文件不存在")
            all_present = False
    
    return all_present

def check_network_connectivity():
    """检查网络连接"""
    print("\n📍 检查网络连接...")
    
    test_urls = [
        'https://augmentcode.com',
        'https://auth.augmentcode.com'
    ]
    
    try:
        import urllib.request
        
        for url in test_urls:
            try:
                with urllib.request.urlopen(url, timeout=10) as response:
                    if response.status == 200:
                        print(f"✅ {url}: 连接正常")
                    else:
                        print(f"⚠️ {url}: HTTP {response.status}")
            except Exception as e:
                print(f"❌ {url}: 连接失败 - {str(e)}")
                
    except ImportError:
        print("⚠️ 无法检查网络连接")

def provide_installation_commands():
    """提供安装命令"""
    print("\n" + "=" * 60)
    print("🛠️ 安装命令参考")
    print("=" * 60)
    
    print("\n1. 安装Python依赖:")
    print("   pip install -r requirements.txt")
    
    print("\n2. 安装Playwright浏览器:")
    print("   python -m playwright install chromium")
    
    print("\n3. 安装系统依赖 (Linux):")
    print("   python -m playwright install-deps")
    
    print("\n4. 验证安装:")
    print("   python verify_environment.py")
    
    print("\n5. 运行自动化脚本:")
    print("   python augment_playwright_screenshot.py")

def main():
    """主函数"""
    print_header()
    
    # 执行所有检查
    checks = []
    
    checks.append(check_python())
    check_system_info()
    checks.append(check_required_packages())
    checks.append(check_playwright_browser())
    check_browser_cache()
    checks.append(check_core_files())
    check_network_connectivity()
    
    # 总结结果
    print("\n" + "=" * 60)
    print("📊 检查结果总结")
    print("=" * 60)
    
    passed_checks = sum(checks)
    total_checks = len(checks)
    
    if passed_checks == total_checks:
        print(f"\n🎉 所有检查通过! ({passed_checks}/{total_checks})")
        print("✅ 环境已就绪，可以运行自动化脚本")
        print("\n运行命令:")
        print("   python augment_playwright_screenshot.py")
    else:
        print(f"\n⚠️ 检查未完全通过 ({passed_checks}/{total_checks})")
        print("❌ 请解决上述问题后重新运行验证")
        provide_installation_commands()
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
