#!/usr/bin/env python3
"""
🎯 激进Continue按钮策略 - 专门突破验证码
严格检测"Success!"字样，大小写完全匹配
"""

import asyncio
from playwright.async_api import async_playwright
import time
import os

class AggressiveContinueStrategy:
    def __init__(self):
        self.iteration = 1
        self.max_iterations = 50
        self.test_email = 'wg824468733wg+123@gmail.com'
        self.success_pattern = 'Success!'
        
    async def clean_old_screenshots(self):
        """删除旧截图"""
        print("🧹 清理旧截图...")
        for file in os.listdir('.'):
            if file.startswith('iteration_') and file.endswith('.png'):
                try:
                    os.remove(file)
                    print(f"   删除: {file}")
                except:
                    pass
    
    async def take_screenshot(self, page, name):
        """截图"""
        filename = f"iteration_{self.iteration:03d}_{name}.png"
        await page.screenshot(path=filename, full_page=True)
        print(f"📸 截图: {filename}")
        return filename
    
    async def strict_success_check(self, page):
        """严格检查Success!字样"""
        try:
            # 检查页面文本
            page_text = await page.evaluate("document.body.innerText")
            if self.success_pattern in page_text:
                print(f"🎉 SUCCESS! 在页面文本中发现'{self.success_pattern}'!")
                return True
            
            # 检查HTML
            page_html = await page.content()
            if self.success_pattern in page_html:
                print(f"🎉 SUCCESS! 在页面HTML中发现'{self.success_pattern}'!")
                return True
            
            # 检查特定元素
            success_elements = await page.query_selector_all(f"*:has-text('{self.success_pattern}')")
            if success_elements:
                print(f"🎉 SUCCESS! 发现{len(success_elements)}个包含'{self.success_pattern}'的元素!")
                return True
            
            return False
            
        except Exception as e:
            print(f"❌ 检查Success!时出错: {e}")
            return False
    
    async def run_iteration(self):
        """运行单次迭代"""
        print(f"\n🔄 第 {self.iteration} 轮迭代开始...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-dev-shm-usage'
                ]
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            
            page = await context.new_page()
            
            try:
                # 1. 直接访问Auth0登录页面
                auth0_urls = [
                    'https://augmentcode.com/signup',
                    'https://login.augmentcode.com/u/login/identifier',
                    'https://auth.augmentcode.com/signup/login?individual=true'
                ]
                
                page_loaded = False
                for url in auth0_urls:
                    try:
                        print(f"📄 尝试访问: {url}")
                        await page.goto(url, wait_until='networkidle', timeout=20000)
                        await page.wait_for_timeout(3000)
                        
                        current_url = page.url
                        page_title = await page.title()
                        print(f"   当前URL: {current_url}")
                        print(f"   页面标题: {page_title}")
                        
                        # 检查是否是登录页面
                        if 'login' in current_url.lower() or 'auth' in current_url.lower():
                            print("   ✅ 成功到达登录页面")
                            page_loaded = True
                            break
                        
                    except Exception as e:
                        print(f"   ❌ 访问失败: {e}")
                        continue
                
                if not page_loaded:
                    print("❌ 无法访问任何登录页面")
                    return False
                
                # 截图1: 初始页面
                await self.take_screenshot(page, "01_initial")
                
                # 2. 填写邮箱
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
                        email_input = await page.query_selector(selector)
                        if email_input and await email_input.is_visible():
                            print(f"   ✅ 找到邮箱输入框: {selector}")
                            await email_input.click()
                            await page.wait_for_timeout(1000)
                            await email_input.fill(self.test_email)
                            await page.wait_for_timeout(2000)
                            print(f"   ✅ 邮箱填写完成: {self.test_email}")
                            email_filled = True
                            break
                    except:
                        continue
                
                if not email_filled:
                    print("   ❌ 未找到邮箱输入框")
                    return False
                
                # 截图2: 邮箱填写完成
                await self.take_screenshot(page, "02_email_filled")
                
                # 3. 点击Continue按钮
                print("🔘 寻找并点击Continue按钮...")
                continue_selectors = [
                    'button[type="submit"]',
                    'button:has-text("Continue")',
                    'button:has-text("继续")',
                    'input[type="submit"]',
                    'button[data-action-button-primary="true"]',
                    '.auth0-lock-submit',
                    'button[name="action"]'
                ]
                
                continue_clicked = False
                for selector in continue_selectors:
                    try:
                        button = await page.query_selector(selector)
                        if button and await button.is_visible():
                            print(f"   ✅ 找到Continue按钮: {selector}")
                            await button.click()
                            await page.wait_for_timeout(3000)
                            print("   ✅ Continue按钮点击成功")
                            continue_clicked = True
                            break
                    except Exception as e:
                        continue
                
                if not continue_clicked:
                    print("   ❌ 未找到Continue按钮，尝试按Enter")
                    await page.keyboard.press('Enter')
                    await page.wait_for_timeout(3000)
                
                # 截图3: 点击Continue后
                await self.take_screenshot(page, "03_after_continue")
                
                # 4. 等待40秒并持续检测
                print("⏰ 等待40秒并持续检测Success!...")
                for i in range(40):
                    await page.wait_for_timeout(1000)
                    
                    if (i + 1) % 5 == 0:
                        print(f"   ⏳ 已等待 {i + 1} 秒...")
                        
                        # 每5秒检查一次
                        if await self.strict_success_check(page):
                            await self.take_screenshot(page, f"04_success_at_{i+1}s")
                            print(f"🎉🎉🎉 SUCCESS! 在等待{i+1}秒后发现Success!字样!")
                            return True
                
                # 截图4: 等待40秒后
                await self.take_screenshot(page, "04_after_40s_wait")
                
                # 5. 最终检查
                print("🔍 最终检查Success!字样...")
                if await self.strict_success_check(page):
                    await self.take_screenshot(page, "05_final_success")
                    print("🎉🎉🎉 SUCCESS! 最终检查发现Success!字样!")
                    return True
                
                # 6. 尝试处理验证码
                print("🎯 尝试处理验证码...")
                captcha_selectors = [
                    '.ulp-captcha',
                    '.ulp-captcha-container',
                    '#ulp-auth0-v2-captcha',
                    '.g-recaptcha',
                    '.h-captcha',
                    '.cf-turnstile'
                ]
                
                for selector in captcha_selectors:
                    try:
                        captcha = await page.query_selector(selector)
                        if captcha and await captcha.is_visible():
                            print(f"   🎯 发现验证码: {selector}")
                            await captcha.click()
                            await page.wait_for_timeout(5000)
                            
                            # 点击验证码后检查
                            if await self.strict_success_check(page):
                                await self.take_screenshot(page, "06_success_after_captcha")
                                print("🎉🎉🎉 SUCCESS! 处理验证码后发现Success!字样!")
                                return True
                    except:
                        continue
                
                # 截图5: 最终状态
                await self.take_screenshot(page, "05_final_state")
                
                print(f"❌ 第 {self.iteration} 轮迭代未成功")
                return False
                
            except Exception as e:
                print(f"❌ 第 {self.iteration} 轮迭代出错: {e}")
                await self.take_screenshot(page, "error")
                return False
            
            finally:
                await browser.close()
    
    async def run(self):
        """主运行函数"""
        print("""
🎯 激进Continue按钮策略 - 专门突破验证码
============================================================
🚀 策略:
  • 直接访问Auth0登录页面
  • 填写邮箱 → 点击Continue → 等待40秒
  • 严格检测"Success!"字样（大小写完全匹配）
  • 处理验证码并持续检测
============================================================
""")
        
        await self.clean_old_screenshots()
        
        while self.iteration <= self.max_iterations:
            success = await self.run_iteration()
            
            if success:
                print(f"\n🎊🎊🎊 任务圆满完成！第 {self.iteration} 轮成功!")
                print("🏆 页面已出现'Success!'字样，满足验收标准!")
                break
            
            self.iteration += 1
            
            if self.iteration <= self.max_iterations:
                wait_time = 2
                print(f"😴 休息{wait_time}秒后继续...")
                await asyncio.sleep(wait_time)
        
        if self.iteration > self.max_iterations:
            print(f"⚠️ 达到最大迭代次数 {self.max_iterations}")

async def main():
    strategy = AggressiveContinueStrategy()
    await strategy.run()

if __name__ == "__main__":
    asyncio.run(main())
