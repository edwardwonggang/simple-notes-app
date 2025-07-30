#!/usr/bin/env python3
"""
Augment Code 注册流程 - Playwright截图版本
使用Playwright进行稳定的浏览器自动化和截图
"""

import asyncio
import time
from playwright.async_api import async_playwright

async def augment_signup_with_playwright():
    """使用Playwright执行Augment Code注册流程并截图"""
    email = "wg824468733wg+123@gmail.com"
    
    async with async_playwright() as p:
        try:
            print("🚀 开始Augment Code注册流程（Playwright版本）...")
            
            # 启动浏览器
            print("\n📱 启动浏览器...")
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            )
            
            # 创建新页面
            page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
            print("✅ 浏览器启动成功")
            
            # 步骤1: 访问注册页面
            print("\n📄 步骤1: 访问注册页面")
            await page.goto("https://augmentcode.com/signup", wait_until='domcontentloaded', timeout=60000)
            
            # 截图1: 初始页面
            await page.screenshot(path="playwright_01_initial_page.png", full_page=True)
            print("✅ 截图已保存: playwright_01_initial_page.png")
            print(f"   URL: {page.url}")
            print(f"   标题: {await page.title()}")
            
            # 等待可能的重定向
            await page.wait_for_timeout(3000)
            
            # 截图2: 重定向后
            await page.screenshot(path="playwright_02_after_redirect.png", full_page=True)
            print("✅ 截图已保存: playwright_02_after_redirect.png")
            print(f"   URL: {page.url}")
            print(f"   标题: {await page.title()}")
            
            # 步骤2: 查找并填写邮箱
            print("\n📝 步骤2: 查找并填写邮箱")
            
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
                    await page.wait_for_selector(selector, timeout=5000)
                    email_input = selector
                    print(f"✅ 找到邮箱输入框: {selector}")
                    break
                except:
                    continue
            
            if email_input:
                # 清空并输入邮箱
                await page.fill(email_input, email)
                print(f"✅ 已输入邮箱: {email}")
                
                # 截图3: 输入邮箱后
                await page.screenshot(path="playwright_03_email_entered.png", full_page=True)
                print("✅ 截图已保存: playwright_03_email_entered.png")
                
                # 步骤3: 查找并点击继续按钮
                print("\n🔘 步骤3: 查找并点击继续按钮")
                
                continue_selectors = [
                    'button[type="submit"]',
                    'button[name="action"]',
                    'button[value="default"]',
                    'input[type="submit"]'
                ]
                
                continue_button = None
                for selector in continue_selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=2000)
                        continue_button = selector
                        print(f"✅ 找到继续按钮: {selector}")
                        break
                    except:
                        continue
                
                if not continue_button:
                    # 查找包含特定文本的按钮
                    try:
                        continue_button = 'button:has-text("Continue")'
                        await page.wait_for_selector(continue_button, timeout=2000)
                        print("✅ 找到Continue按钮")
                    except:
                        try:
                            continue_button = 'button:has-text("continue")'
                            await page.wait_for_selector(continue_button, timeout=2000)
                            print("✅ 找到continue按钮")
                        except:
                            # 查找所有按钮
                            buttons = await page.query_selector_all('button')
                            for i, btn in enumerate(buttons):
                                btn_text = await btn.text_content()
                                btn_type = await btn.get_attribute('type')
                                if btn_text and ('continue' in btn_text.lower() or 
                                               'submit' in btn_text.lower() or 
                                               btn_type == 'submit'):
                                    continue_button = f'button >> nth={i}'
                                    print(f"✅ 找到按钮: '{btn_text}' (type={btn_type})")
                                    break
                
                if continue_button:
                    # 截图4: 点击前
                    await page.screenshot(path="playwright_04_before_click.png", full_page=True)
                    print("✅ 截图已保存: playwright_04_before_click.png")
                    
                    # 点击按钮
                    await page.click(continue_button)
                    print("✅ 已点击继续按钮")
                    
                    # 等待页面响应
                    await page.wait_for_timeout(5000)
                    
                    # 截图5: 点击后
                    await page.screenshot(path="playwright_05_after_click.png", full_page=True)
                    print("✅ 截图已保存: playwright_05_after_click.png")
                    print(f"   URL: {page.url}")
                    print(f"   标题: {await page.title()}")
                    
                    # 步骤4: 检查结果
                    print("\n🔍 步骤4: 检查结果")
                    
                    page_content = await page.content()
                    page_content_lower = page_content.lower()
                    
                    # 检查是否跳转到验证页面
                    verification_keywords = [
                        "verification", "verify", "code", "check your email",
                        "enter the code", "6-digit", "confirm", "验证码", "验证",
                        "email sent", "we sent", "inbox"
                    ]
                    
                    found_keywords = [kw for kw in verification_keywords if kw in page_content_lower]
                    
                    if found_keywords:
                        print(f"✅ 检测到验证相关内容: {found_keywords}")
                        await page.screenshot(path="playwright_06_verification_page.png", full_page=True)
                        print("✅ 截图已保存: playwright_06_verification_page.png")
                        
                        # 保存页面HTML
                        with open("playwright_verification_page.html", "w", encoding="utf-8") as f:
                            f.write(page_content)
                        print("✅ 已保存验证页面HTML")
                        
                        success = True
                    else:
                        print("⚠️ 未检测到明确的验证页面")
                        await page.screenshot(path="playwright_06_final_page.png", full_page=True)
                        print("✅ 截图已保存: playwright_06_final_page.png")
                        
                        # 保存页面HTML
                        with open("playwright_final_page.html", "w", encoding="utf-8") as f:
                            f.write(page_content)
                        print("✅ 已保存最终页面HTML")
                        
                        success = False
                else:
                    print("❌ 未找到继续按钮")
                    await page.screenshot(path="playwright_error_no_button.png", full_page=True)
                    print("✅ 截图已保存: playwright_error_no_button.png")
                    success = False
            else:
                print("❌ 未找到邮箱输入框")
                await page.screenshot(path="playwright_error_no_email_input.png", full_page=True)
                print("✅ 截图已保存: playwright_error_no_email_input.png")
                success = False
            
            # 关闭浏览器
            await browser.close()
            return success
            
        except Exception as e:
            print(f"❌ 发生错误：{str(e)}")
            try:
                await page.screenshot(path="playwright_error_exception.png", full_page=True)
                print("✅ 截图已保存: playwright_error_exception.png")
            except:
                pass
            try:
                await browser.close()
            except:
                pass
            return False

def create_playwright_summary():
    """创建Playwright截图总结"""
    import os
    
    print("\n" + "="*80)
    print("📸 AUGMENT CODE 注册流程截图总结 (Playwright版本)")
    print("="*80)
    
    # 检查生成的截图文件
    screenshot_files = [f for f in os.listdir('.') if f.startswith('playwright_') and f.endswith('.png')]
    screenshot_files.sort()
    
    if screenshot_files:
        print(f"\n✅ 成功生成 {len(screenshot_files)} 张截图:")
        for i, filename in enumerate(screenshot_files, 1):
            size = os.path.getsize(filename)
            print(f"  {i}. {filename} ({size:,} bytes)")
    else:
        print("\n❌ 未找到截图文件")
    
    # 检查HTML文件
    html_files = [f for f in os.listdir('.') if f.startswith('playwright_') and f.endswith('.html')]
    if html_files:
        print(f"\n📄 生成的HTML文件:")
        for filename in html_files:
            size = os.path.getsize(filename)
            print(f"  • {filename} ({size:,} bytes)")
    
    print(f"\n📧 使用的邮箱: wg824468733wg+123@gmail.com")
    print("\n💡 建议:")
    print("  1. 查看生成的截图文件了解完整流程")
    print("  2. 检查邮箱是否收到验证邮件")
    print("  3. 如果收到邮件，点击验证链接完成注册")
    print("  4. 查看HTML文件了解页面详细内容")
    print("="*80)

async def main():
    """主函数"""
    success = await augment_signup_with_playwright()
    create_playwright_summary()
    
    if success:
        print("\n🎉 注册流程可能已成功完成！请查看截图和检查邮箱。")
    else:
        print("\n⚠️ 注册流程可能未完全成功，请查看截图了解详情。")
    
    print("\nPlaywright截图流程完成！")

if __name__ == "__main__":
    asyncio.run(main())
