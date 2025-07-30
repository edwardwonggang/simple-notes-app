#!/usr/bin/env python3
"""
Augment Code 注册流程 - 真实浏览器截图版本
使用本地ChromeDriver进行真实的浏览器自动化和截图
"""

import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def setup_driver():
    """设置Chrome浏览器驱动"""
    chrome_options = Options()

    # 基本设置
    chrome_options.add_argument("--headless")  # 无头模式
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-plugins")
    chrome_options.add_argument("--disable-images")
    chrome_options.add_argument("--disable-javascript")
    chrome_options.add_argument("--disable-css")
    chrome_options.add_argument("--disable-web-security")
    chrome_options.add_argument("--disable-features=VizDisplayCompositor")
    chrome_options.add_argument("--remote-debugging-port=9222")
    chrome_options.add_argument("--single-process")
    chrome_options.add_argument("--disable-background-timer-throttling")
    chrome_options.add_argument("--disable-renderer-backgrounding")
    chrome_options.add_argument("--disable-backgrounding-occluded-windows")

    # 尝试使用本地ChromeDriver
    try:
        service = Service("./chromedriver")
        driver = webdriver.Chrome(service=service, options=chrome_options)
        return driver
    except Exception as e:
        print(f"本地ChromeDriver失败: {e}")
        raise e

def take_screenshot(driver, filename, description=""):
    """截图并保存"""
    try:
        # 等待页面加载
        time.sleep(2)
        
        # 截图
        driver.save_screenshot(filename)
        print(f"✅ 截图已保存: {filename}")
        if description:
            print(f"   描述: {description}")
        
        # 获取页面信息
        current_url = driver.current_url
        page_title = driver.title
        print(f"   URL: {current_url}")
        print(f"   标题: {page_title}")
        
        return True
    except Exception as e:
        print(f"❌ 截图失败: {e}")
        return False

def augment_signup_with_screenshots():
    """执行Augment Code注册流程并截图"""
    email = "wg824468733wg+123@gmail.com"
    driver = None
    
    try:
        print("🚀 开始Augment Code注册流程（带截图）...")
        
        # 启动浏览器
        print("\n📱 启动浏览器...")
        driver = setup_driver()
        print("✅ 浏览器启动成功")
        
        # 步骤1: 访问注册页面
        print("\n📄 步骤1: 访问注册页面")
        driver.get("https://augmentcode.com/signup")
        take_screenshot(driver, "screenshot_01_initial_page.png", "初始注册页面")
        
        # 等待重定向
        time.sleep(3)
        take_screenshot(driver, "screenshot_02_after_redirect.png", "重定向后的页面")
        
        # 步骤2: 查找并填写邮箱
        print("\n📝 步骤2: 查找并填写邮箱")
        
        # 等待页面完全加载
        wait = WebDriverWait(driver, 10)
        
        # 尝试多种邮箱输入框选择器
        email_selectors = [
            'input[name="username"]',
            'input[type="email"]',
            'input[name="email"]',
            'input[id="username"]',
            'input[id="email"]',
            'input[inputmode="email"]'
        ]
        
        email_input = None
        for selector in email_selectors:
            try:
                email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                print(f"✅ 找到邮箱输入框: {selector}")
                break
            except TimeoutException:
                continue
        
        if email_input:
            # 清空并输入邮箱
            email_input.clear()
            email_input.send_keys(email)
            print(f"✅ 已输入邮箱: {email}")
            
            # 截图：输入邮箱后
            take_screenshot(driver, "screenshot_03_email_entered.png", "输入邮箱后")
            
            # 步骤3: 查找并点击继续按钮
            print("\n🔘 步骤3: 查找并点击继续按钮")
            
            continue_selectors = [
                'button[type="submit"]',
                'button[name="action"]',
                'button[value="default"]',
                'input[type="submit"]',
                'button:contains("Continue")',
                'button:contains("continue")'
            ]
            
            continue_button = None
            for selector in continue_selectors:
                try:
                    if ":contains(" in selector:
                        # 使用XPath查找包含特定文本的按钮
                        text = selector.split(":contains(")[1].rstrip(')"')
                        continue_button = driver.find_element(By.XPATH, f"//button[contains(text(), '{text}')]")
                    else:
                        continue_button = driver.find_element(By.CSS_SELECTOR, selector)
                    print(f"✅ 找到继续按钮: {selector}")
                    break
                except NoSuchElementException:
                    continue
            
            if not continue_button:
                # 查找所有按钮
                buttons = driver.find_elements(By.TAG_NAME, "button")
                for btn in buttons:
                    btn_text = btn.text.strip().lower()
                    btn_type = btn.get_attribute("type")
                    if ("continue" in btn_text or "submit" in btn_text or 
                        btn_type == "submit" or "next" in btn_text):
                        continue_button = btn
                        print(f"✅ 找到按钮: '{btn.text}' (type={btn_type})")
                        break
            
            if continue_button:
                # 滚动到按钮位置
                driver.execute_script("arguments[0].scrollIntoView();", continue_button)
                time.sleep(1)
                
                # 截图：点击前
                take_screenshot(driver, "screenshot_04_before_click.png", "点击继续按钮前")
                
                # 点击按钮
                continue_button.click()
                print("✅ 已点击继续按钮")
                
                # 等待页面响应
                time.sleep(5)
                
                # 截图：点击后
                take_screenshot(driver, "screenshot_05_after_click.png", "点击继续按钮后")
                
                # 步骤4: 检查结果
                print("\n🔍 步骤4: 检查结果")
                
                current_url = driver.current_url
                page_source = driver.page_source.lower()
                
                # 检查是否跳转到验证页面
                verification_keywords = [
                    "verification", "verify", "code", "check your email",
                    "enter the code", "6-digit", "confirm", "验证码", "验证"
                ]
                
                found_keywords = [kw for kw in verification_keywords if kw in page_source]
                
                if found_keywords:
                    print(f"✅ 检测到验证相关内容: {found_keywords}")
                    take_screenshot(driver, "screenshot_06_verification_page.png", "验证码页面")
                    return True
                else:
                    print("⚠️ 未检测到明确的验证页面")
                    take_screenshot(driver, "screenshot_06_final_page.png", "最终页面")
                    return False
            else:
                print("❌ 未找到继续按钮")
                take_screenshot(driver, "screenshot_error_no_button.png", "找不到继续按钮")
                return False
        else:
            print("❌ 未找到邮箱输入框")
            take_screenshot(driver, "screenshot_error_no_email_input.png", "找不到邮箱输入框")
            return False
            
    except Exception as e:
        print(f"❌ 发生错误：{str(e)}")
        if driver:
            take_screenshot(driver, "screenshot_error_exception.png", f"异常截图: {str(e)}")
        return False
    
    finally:
        if driver:
            print("\n🔄 保持浏览器打开5秒以便观察...")
            time.sleep(5)
            print("正在关闭浏览器...")
            driver.quit()

def create_screenshot_summary():
    """创建截图总结"""
    print("\n" + "="*80)
    print("📸 AUGMENT CODE 注册流程截图总结")
    print("="*80)
    
    # 检查生成的截图文件
    screenshot_files = [f for f in os.listdir('.') if f.startswith('screenshot_') and f.endswith('.png')]
    screenshot_files.sort()
    
    if screenshot_files:
        print(f"\n✅ 成功生成 {len(screenshot_files)} 张截图:")
        for i, filename in enumerate(screenshot_files, 1):
            size = os.path.getsize(filename)
            print(f"  {i}. {filename} ({size:,} bytes)")
    else:
        print("\n❌ 未找到截图文件")
    
    print(f"\n📧 使用的邮箱: wg824468733wg+123@gmail.com")
    print("\n💡 建议:")
    print("  1. 查看生成的截图文件了解完整流程")
    print("  2. 检查邮箱是否收到验证邮件")
    print("  3. 如果收到邮件，点击验证链接完成注册")
    print("="*80)

if __name__ == "__main__":
    success = augment_signup_with_screenshots()
    create_screenshot_summary()
    
    if success:
        print("\n🎉 注册流程可能已成功完成！请查看截图和检查邮箱。")
    else:
        print("\n⚠️ 注册流程可能未完全成功，请查看截图了解详情。")
    
    print("\n截图流程完成！")
