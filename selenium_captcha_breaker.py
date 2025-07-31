#!/usr/bin/env python3
"""
🎯 Augment Code 验证码突破工具 - Selenium版本
使用Selenium WebDriver进行验证码突破
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
import time
import random

def setup_driver():
    """设置Chrome驱动"""
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

def main():
    print("""
🎯 Augment Code 验证码突破工具 - Selenium版本
============================================================
🚀 特性:
  • 使用Selenium WebDriver
  • 多种验证码检测策略
  • 无限迭代直到成功
============================================================
""")

    driver = setup_driver()
    
    try:
        iteration = 1
        while iteration <= 50:
            print(f"\n🔄 第 {iteration} 轮迭代开始...")
            
            try:
                # 访问页面
                print("📄 访问注册页面...")
                driver.get('https://augmentcode.com/signup')
                time.sleep(5)
                
                # 填写邮箱
                print("📧 填写邮箱...")
                email_selectors = [
                    'input[name="username"]',
                    'input[name="email"]',
                    'input[type="email"]',
                    '#email',
                    '#username'
                ]
                
                email_filled = False
                for selector in email_selectors:
                    try:
                        email_input = driver.find_element(By.CSS_SELECTOR, selector)
                        if email_input.is_displayed():
                            email_input.click()
                            time.sleep(1)
                            email_input.clear()
                            email_input.send_keys('wg824468733wg+123@gmail.com')
                            time.sleep(2)
                            print(f"✅ 邮箱填写成功: {selector}")
                            email_filled = True
                            break
                    except:
                        continue
                
                if not email_filled:
                    print("❌ 未找到邮箱输入框")
                    continue
                
                # 寻找并点击Continue按钮
                print("🔍 寻找Continue按钮...")
                continue_selectors = [
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'button[data-action-button-primary="true"]',
                    'button[name="action"]',
                    '.auth0-lock-submit'
                ]
                
                continue_clicked = False
                for selector in continue_selectors:
                    try:
                        button = driver.find_element(By.CSS_SELECTOR, selector)
                        if button.is_displayed():
                            print(f"✅ 找到Continue按钮: {selector}")
                            button.click()
                            time.sleep(5)
                            print("✅ Continue按钮点击成功")
                            continue_clicked = True
                            break
                    except Exception as e:
                        continue
                
                if not continue_clicked:
                    print("❌ 未找到Continue按钮，尝试按Enter")
                    driver.find_element(By.TAG_NAME, 'body').send_keys(Keys.ENTER)
                    time.sleep(5)
                
                # 等待验证码加载
                print("⏳ 等待验证码加载...")
                time.sleep(8)
                
                # 检查验证码
                print("🔍 检查验证码...")
                captcha_selectors = [
                    'iframe[src*="recaptcha"]',
                    'iframe[src*="hcaptcha"]',
                    'iframe[src*="turnstile"]',
                    '.g-recaptcha',
                    '.h-captcha',
                    '.cf-turnstile',
                    '.ulp-captcha',
                    '.recaptcha-checkbox',
                    '[data-sitekey]',
                    '.ulp-captcha-container',
                    '#ulp-auth0-v2-captcha'
                ]
                
                captcha_elements = []
                for selector in captcha_selectors:
                    try:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        for element in elements:
                            if element.is_displayed():
                                captcha_elements.append((selector, element))
                                print(f"🎯 发现验证码: {selector}")
                    except:
                        continue
                
                if captcha_elements:
                    print(f"✅ 发现 {len(captcha_elements)} 个验证码元素")
                    
                    # 尝试点击每个验证码元素
                    for selector, element in captcha_elements:
                        print(f"🎯 尝试点击验证码: {selector}")
                        
                        # 方法1: 直接点击
                        try:
                            element.click()
                            time.sleep(3)
                            print("✅ 直接点击成功")
                        except:
                            print("❌ 直接点击失败")
                        
                        # 方法2: ActionChains点击
                        try:
                            actions = ActionChains(driver)
                            actions.move_to_element(element).click().perform()
                            time.sleep(3)
                            print("✅ ActionChains点击成功")
                        except:
                            print("❌ ActionChains点击失败")
                        
                        # 方法3: JavaScript点击
                        try:
                            driver.execute_script("arguments[0].click();", element)
                            time.sleep(3)
                            print("✅ JavaScript点击成功")
                        except:
                            print("❌ JavaScript点击失败")
                        
                        # 检查是否成功
                        if 'success' in driver.page_source.lower():
                            print("🎉🎉🎉 SUCCESS! 发现成功标识!")
                            print("🏆 验证码突破成功!")
                            return
                        
                        time.sleep(2)
                
                else:
                    print("❌ 未发现验证码元素")
                
                # 检查页面内容
                if 'success' in driver.page_source.lower():
                    print("🎉🎉🎉 SUCCESS! 发现成功标识!")
                    print("🏆 验证码突破成功!")
                    break
                
                print(f"❌ 第 {iteration} 轮迭代未成功")
                print(f"📍 当前URL: {driver.current_url}")
                
            except Exception as e:
                print(f"❌ 第 {iteration} 轮迭代出错: {e}")
            
            iteration += 1
            print("😴 休息3秒后继续...")
            time.sleep(3)
        
        print("⚠️ 达到最大迭代次数，停止尝试")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
