#!/usr/bin/env python3
"""
一键安装脚本 - Augment Code 自动化工具
自动安装所有必要的依赖和资源
"""

import sys
import subprocess
import os
import platform
from pathlib import Path

def print_header():
    """打印安装标题"""
    print("=" * 60)
    print("🚀 Augment Code 自动化工具 - 一键安装")
    print("=" * 60)
    print("正在安装所有必要的依赖和资源...")

def check_python_version():
    """检查Python版本"""
    print("\n📍 检查Python版本...")
    version = sys.version_info
    
    if version.major >= 3 and version.minor >= 8:
        print(f"✅ Python版本符合要求: {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"❌ Python版本过低: {version.major}.{version.minor}.{version.micro}")
        print("   要求: Python 3.8+")
        print("   请升级Python后重新运行安装脚本")
        return False

def run_command(command, description, check_return_code=True):
    """运行命令并显示结果"""
    print(f"\n🔄 {description}...")
    print(f"   命令: {command}")
    
    try:
        if isinstance(command, str):
            result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=300)
        else:
            result = subprocess.run(command, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0 or not check_return_code:
            print(f"✅ {description} - 完成")
            if result.stdout.strip():
                # 只显示重要的输出信息
                lines = result.stdout.strip().split('\n')
                important_lines = [line for line in lines if any(keyword in line.lower() 
                                 for keyword in ['successfully', 'installed', 'downloading', 'complete'])]
                if important_lines:
                    for line in important_lines[-3:]:  # 只显示最后3行重要信息
                        print(f"   {line}")
            return True
        else:
            print(f"❌ {description} - 失败")
            if result.stderr.strip():
                print(f"   错误: {result.stderr.strip()}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"⏰ {description} - 超时")
        return False
    except Exception as e:
        print(f"❌ {description} - 异常: {str(e)}")
        return False

def install_python_dependencies():
    """安装Python依赖"""
    print("\n📦 安装Python依赖包...")
    
    # 检查requirements.txt是否存在
    if not os.path.exists('requirements.txt'):
        print("❌ requirements.txt文件不存在")
        print("   正在创建requirements.txt...")
        
        requirements_content = """pyperclip==1.8.2
selenium==4.15.2
webdriver-manager==4.0.1
playwright==1.40.0
"""
        with open('requirements.txt', 'w') as f:
            f.write(requirements_content)
        print("✅ requirements.txt已创建")
    
    # 升级pip
    run_command([sys.executable, '-m', 'pip', 'install', '--upgrade', 'pip'], 
                "升级pip", check_return_code=False)
    
    # 安装依赖
    success = run_command([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], 
                         "安装Python依赖包")
    
    return success

def install_playwright_browsers():
    """安装Playwright浏览器"""
    print("\n🌐 安装Playwright浏览器...")
    
    # 安装Chromium浏览器
    success = run_command([sys.executable, '-m', 'playwright', 'install', 'chromium'], 
                         "安装Chromium浏览器")
    
    if not success:
        return False
    
    # 安装系统依赖 (仅Linux)
    if platform.system() == 'Linux':
        print("\n🔧 安装系统依赖库 (Linux)...")
        success = run_command([sys.executable, '-m', 'playwright', 'install-deps'], 
                             "安装系统依赖库", check_return_code=False)
    
    return True

def verify_installation():
    """验证安装结果"""
    print("\n🔍 验证安装结果...")
    
    # 检查Python包
    packages_to_check = ['playwright', 'selenium', 'pyperclip', 'webdriver_manager']
    
    for package in packages_to_check:
        try:
            if package == 'webdriver_manager':
                import webdriver_manager
                version = webdriver_manager.__version__
            else:
                module = __import__(package)
                version = getattr(module, '__version__', 'unknown')
            print(f"✅ {package}: {version}")
        except ImportError:
            print(f"❌ {package}: 未安装")
            return False
    
    # 检查Playwright浏览器
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            print("✅ Chromium浏览器: 可用")
            browser.close()
    except Exception as e:
        print(f"❌ Chromium浏览器: 不可用 - {str(e)}")
        return False
    
    return True

def create_run_script():
    """创建运行脚本"""
    print("\n📝 创建运行脚本...")
    
    # Windows批处理文件
    if platform.system() == 'Windows':
        bat_content = """@echo off
echo 🚀 启动Augment Code自动化工具...
python augment_playwright_screenshot.py
pause
"""
        with open('run_automation.bat', 'w') as f:
            f.write(bat_content)
        print("✅ 已创建 run_automation.bat")
    
    # Unix shell脚本
    else:
        sh_content = """#!/bin/bash
echo "🚀 启动Augment Code自动化工具..."
python augment_playwright_screenshot.py
"""
        with open('run_automation.sh', 'w') as f:
            f.write(sh_content)
        os.chmod('run_automation.sh', 0o755)
        print("✅ 已创建 run_automation.sh")

def show_completion_message():
    """显示完成信息"""
    print("\n" + "=" * 60)
    print("🎉 安装完成!")
    print("=" * 60)
    
    print("\n📁 已安装的组件:")
    print("   ✅ Python依赖包 (playwright, selenium, pyperclip, webdriver-manager)")
    print("   ✅ Chromium浏览器 (~153MB)")
    print("   ✅ 系统依赖库 (Linux)")
    print("   ✅ 运行脚本")
    
    print("\n🚀 运行方法:")
    print("   方法1: python augment_playwright_screenshot.py")
    
    if platform.system() == 'Windows':
        print("   方法2: 双击 run_automation.bat")
    else:
        print("   方法2: ./run_automation.sh")
    
    print("\n🔍 验证环境:")
    print("   python verify_environment.py")
    
    print("\n📖 查看文档:")
    print("   DEPLOYMENT_GUIDE.md - 完整部署指南")
    print("   AUTOMATION_README.md - 使用说明")
    
    print("\n💡 提示:")
    print("   - 脚本会自动生成截图记录整个过程")
    print("   - 支持人机认证自动处理")
    print("   - 具备智能重试机制")
    print("   - 成功后请检查邮箱验证邮件")

def main():
    """主安装流程"""
    print_header()
    
    # 检查Python版本
    if not check_python_version():
        sys.exit(1)
    
    # 显示系统信息
    print(f"\n💻 系统信息:")
    print(f"   操作系统: {platform.system()} {platform.release()}")
    print(f"   Python路径: {sys.executable}")
    
    # 执行安装步骤
    steps = [
        (install_python_dependencies, "安装Python依赖"),
        (install_playwright_browsers, "安装Playwright浏览器"),
        (verify_installation, "验证安装"),
        (create_run_script, "创建运行脚本")
    ]
    
    for step_func, step_name in steps:
        try:
            if not step_func():
                print(f"\n❌ {step_name}失败，安装中止")
                print("\n🛠️ 请检查错误信息并手动解决问题")
                print("   或参考 DEPLOYMENT_GUIDE.md 进行手动安装")
                sys.exit(1)
        except KeyboardInterrupt:
            print(f"\n⏹️ 用户中断安装")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ {step_name}时发生异常: {str(e)}")
            sys.exit(1)
    
    # 显示完成信息
    show_completion_message()

if __name__ == "__main__":
    main()
