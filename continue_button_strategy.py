#!/usr/bin/env python3
"""
🎯 Augment Code 验证码突破工具 - Continue按钮策略
专门针对需要先点击Continue按钮才显示验证码的情况
"""

import asyncio
from playwright.async_api import async_playwright
import time
import re

async def main():
    print("""
🎯 Augment Code 验证码突破工具 - Continue按钮策略
============================================================
🚀 特性:
  • 先点击Continue按钮触发验证码
  • 然后处理验证码
  • 无限迭代直到成功
============================================================
""")

    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--no-sandbox',
                '--disable-dev-shm-usage'
            ]
        )
        
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        page = await context.new_page()
        
        iteration = 1
        while iteration <= 100:
            print(f"\n🔄 第 {iteration} 轮迭代开始...")
            
            try:
                # 访问页面
                print("📄 访问注册页面...")
                await page.goto('https://augmentcode.com/signup', wait_until='networkidle')
                await page.wait_for_timeout(3000)
                
                # 填写邮箱
                print("📧 填写邮箱...")
                email_selectors = [
                    'input[name="username"]',
                    'input[name="email"]',
                    'input[type="email"]'
                ]
                
                email_filled = False
                for selector in email_selectors:
                    try:
                        email_input = await page.query_selector(selector)
                        if email_input and await email_input.is_visible():
                            await email_input.click()
                            await page.wait_for_timeout(1000)
                            await email_input.fill('wg824468733wg+123@gmail.com')
                            await page.wait_for_timeout(2000)
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
                    'button:has-text("Continue")',
                    'button:has-text("继续")',
                    'input[type="submit"]',
                    'button[data-action-button-primary="true"]',
                    '.auth0-lock-submit',
                    '[data-testid="continue-button"]',
                    'button.c-button--primary',
                    'button[name="action"]'
                ]
                
                continue_clicked = False
                for selector in continue_selectors:
                    try:
                        button = await page.query_selector(selector)
                        if button and await button.is_visible():
                            print(f"✅ 找到Continue按钮: {selector}")
                            await button.click()
                            await page.wait_for_timeout(5000)  # 等待验证码加载
                            print("✅ Continue按钮点击成功")
                            continue_clicked = True
                            break
                    except Exception as e:
                        print(f"   ⚠️ 点击按钮失败 {selector}: {e}")
                        continue
                
                if not continue_clicked:
                    print("❌ 未找到或无法点击Continue按钮")
                    # 尝试按Enter键
                    print("🔄 尝试按Enter键...")
                    await page.keyboard.press('Enter')
                    await page.wait_for_timeout(5000)
                
                # 现在检查验证码
                print("🔍 检查验证码是否出现...")
                
                # 检查各种验证码类型
                captcha_selectors = [
                    'iframe[src*="recaptcha"]',
                    'iframe[src*="hcaptcha"]', 
                    'iframe[src*="turnstile"]',
                    '.g-recaptcha',
                    '.h-captcha',
                    '.cf-turnstile',
                    '.ulp-captcha',
                    '.recaptcha-checkbox',
                    '[data-sitekey]'
                ]
                
                captcha_found = False
                for selector in captcha_selectors:
                    try:
                        elements = await page.query_selector_all(selector)
                        for element in elements:
                            if await element.is_visible():
                                print(f"🎯 发现验证码: {selector}")
                                captcha_found = True
                                
                                # 尝试点击验证码
                                try:
                                    await element.click()
                                    await page.wait_for_timeout(3000)
                                    print("✅ 验证码点击成功")
                                except:
                                    print("⚠️ 验证码点击失败，尝试其他方法")
                                
                                break
                    except:
                        continue
                
                if captcha_found:
                    print("🎉 发现验证码！继续处理...")
                else:
                    print("❌ 未发现验证码")
                
                # 检查是否成功
                await page.wait_for_timeout(3000)
                page_content = await page.content()
                
                if 'success' in page_content.lower():
                    print("🎉🎉🎉 SUCCESS! 发现成功标识!")
                    print("🏆 验证码突破成功!")
                    break
                
                # 检查页面变化
                current_url = page.url
                print(f"📍 当前URL: {current_url}")
                
                if 'password' in current_url.lower() or 'signup' in current_url.lower():
                    print("🔄 页面已跳转，可能需要进一步操作")
                
                print(f"❌ 第 {iteration} 轮迭代未成功")
                
            except Exception as e:
                print(f"❌ 第 {iteration} 轮迭代出错: {e}")
            
            iteration += 1
            print("😴 休息3秒后继续...")
            await asyncio.sleep(3)
        
        print("⚠️ 达到最大迭代次数，停止尝试")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
