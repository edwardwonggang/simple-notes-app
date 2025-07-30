#!/usr/bin/env python3
"""
Augment Code 注册自动化脚本
自动访问注册页面，输入邮箱，点击继续按钮，并截图
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
from webdriver_manager.chrome import ChromeDriverManager

def setup_driver():
    """设置Chrome浏览器驱动"""
    chrome_options = Options()
    # 启用无头模式（不显示浏览器窗口）- 在服务器环境中必需
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-plugins")
    chrome_options.add_argument("--remote-debugging-port=9222")

    try:
        # 尝试使用系统的ChromeDriver
        service = Service("/usr/bin/chromedriver")
        driver = webdriver.Chrome(service=service, options=chrome_options)
        return driver
    except Exception as e:
        print(f"系统ChromeDriver失败: {e}")
        # 尝试自动下载和管理ChromeDriver
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            return driver
        except Exception as e2:
            print(f"自动ChromeDriver也失败: {e2}")
            raise e2

def augment_signup_automation():
    """执行Augment Code注册自动化流程"""
    email = "wg824468733wg+123@gmail.com"
    driver = None
    
    try:
        print("正在启动浏览器...")
        driver = setup_driver()
        
        print("正在访问Augment Code注册页面...")
        driver.get("https://augmentcode.com/signup")
        
        # 等待页面加载并可能的重定向
        time.sleep(3)
        
        # 截图1：初始页面
        screenshot_path_1 = "augment_signup_step1.png"
        driver.save_screenshot(screenshot_path_1)
        print(f"已保存初始页面截图：{screenshot_path_1}")
        
        # 等待重定向到实际的注册页面
        wait = WebDriverWait(driver, 10)
        
        # 尝试多种可能的邮箱输入框选择器
        email_selectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input[id="email"]',
            'input[placeholder*="email"]',
            'input[placeholder*="Email"]',
            '.email-input',
            '#email-input'
        ]
        
        email_input = None
        for selector in email_selectors:
            try:
                email_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                print(f"找到邮箱输入框，使用选择器：{selector}")
                break
            except TimeoutException:
                continue
        
        if not email_input:
            print("未找到邮箱输入框，尝试查找所有input元素...")
            inputs = driver.find_elements(By.TAG_NAME, "input")
            for i, inp in enumerate(inputs):
                input_type = inp.get_attribute("type")
                input_name = inp.get_attribute("name")
                input_id = inp.get_attribute("id")
                input_placeholder = inp.get_attribute("placeholder")
                print(f"Input {i}: type={input_type}, name={input_name}, id={input_id}, placeholder={input_placeholder}")
                
                # 如果找到可能的邮箱输入框
                if (input_type == "email" or 
                    (input_name and "email" in input_name.lower()) or
                    (input_id and "email" in input_id.lower()) or
                    (input_placeholder and "email" in input_placeholder.lower())):
                    email_input = inp
                    break
        
        if email_input:
            print(f"正在输入邮箱：{email}")
            email_input.clear()
            email_input.send_keys(email)
            time.sleep(1)
            
            # 截图2：输入邮箱后
            screenshot_path_2 = "augment_signup_step2.png"
            driver.save_screenshot(screenshot_path_2)
            print(f"已保存输入邮箱后的截图：{screenshot_path_2}")
            
            # 查找继续按钮
            continue_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:contains("Continue")',
                'button:contains("continue")',
                'button:contains("继续")',
                '.continue-btn',
                '.submit-btn',
                '#continue-btn',
                '#submit-btn'
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
                    print(f"找到继续按钮，使用选择器：{selector}")
                    break
                except NoSuchElementException:
                    continue
            
            if not continue_button:
                print("未找到继续按钮，查找所有按钮...")
                buttons = driver.find_elements(By.TAG_NAME, "button")
                for i, btn in enumerate(buttons):
                    btn_text = btn.text.strip().lower()
                    btn_type = btn.get_attribute("type")
                    print(f"Button {i}: text='{btn_text}', type={btn_type}")
                    
                    if ("continue" in btn_text or "submit" in btn_text or 
                        "next" in btn_text or "sign" in btn_text or
                        btn_type == "submit"):
                        continue_button = btn
                        break
            
            if continue_button:
                print("正在点击继续按钮...")
                driver.execute_script("arguments[0].scrollIntoView();", continue_button)
                time.sleep(1)
                continue_button.click()
                
                # 等待页面跳转
                time.sleep(3)
                
                # 截图3：点击继续后
                screenshot_path_3 = "augment_signup_step3.png"
                driver.save_screenshot(screenshot_path_3)
                print(f"已保存点击继续后的截图：{screenshot_path_3}")
                
                # 检查是否跳转到验证码页面
                current_url = driver.current_url
                print(f"当前页面URL：{current_url}")
                
                # 查找验证码相关元素
                verification_indicators = [
                    "verification",
                    "verify",
                    "code",
                    "验证",
                    "验证码"
                ]
                
                page_source = driver.page_source.lower()
                found_verification = any(indicator in page_source for indicator in verification_indicators)
                
                if found_verification:
                    print("✅ 成功跳转到验证码页面！")
                else:
                    print("⚠️ 可能未跳转到验证码页面，请检查截图")
                
                # 等待一段时间以便观察结果
                time.sleep(5)
                
            else:
                print("❌ 未找到继续按钮")
                
        else:
            print("❌ 未找到邮箱输入框")
            
    except Exception as e:
        print(f"❌ 发生错误：{str(e)}")
        if driver:
            screenshot_path_error = "augment_signup_error.png"
            driver.save_screenshot(screenshot_path_error)
            print(f"已保存错误截图：{screenshot_path_error}")
    
    finally:
        if driver:
            print("正在关闭浏览器...")
            driver.quit()

if __name__ == "__main__":
    print("开始Augment Code注册自动化流程...")
    augment_signup_automation()
    print("自动化流程完成！")
