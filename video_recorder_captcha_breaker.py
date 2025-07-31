#!/usr/bin/env python3
"""
🎥 视频录制版验证码突破工具
录制整个浏览器操作过程，便于观察和分析失败原因
"""

import asyncio
from playwright.async_api import async_playwright
import time
import os
from datetime import datetime

class VideoRecorderCaptchaBreaker:
    def __init__(self):
        self.iteration = 1
        self.test_email = 'wg824468733wg+123@gmail.com'
        self.video_path = None
        self.start_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        
    async def setup_video_recording(self, page):
        """设置视频录制"""
        self.video_path = f"captcha_breakthrough_{self.start_time}.webm"
        print(f"🎥 开始录制视频: {self.video_path}")
        
        # 启动视频录制
        await page.video.start_recording(path=self.video_path)
        return self.video_path
    
    async def stop_video_recording(self, page):
        """停止视频录制"""
        if self.video_path:
            try:
                await page.video.stop_recording()
                print(f"🎬 视频录制完成: {self.video_path}")
                
                # 检查文件是否存在
                if os.path.exists(self.video_path):
                    file_size = os.path.getsize(self.video_path)
                    print(f"📁 视频文件大小: {file_size / 1024 / 1024:.2f} MB")
                else:
                    print("⚠️ 视频文件未生成")
            except Exception as e:
                print(f"❌ 停止录制时出错: {e}")
    
    async def take_screenshot(self, page, name):
        """截图"""
        filename = f"video_debug_{self.iteration:03d}_{name}.png"
        await page.screenshot(path=filename, full_page=True)
        print(f"📸 截图: {filename}")
        return filename
    
    async def log_page_state(self, page, step_name):
        """记录页面状态"""
        print(f"\n📊 页面状态 - {step_name}")
        print(f"   URL: {page.url}")
        print(f"   标题: {await page.title()}")
        
        # 检查页面是否加载完成
        try:
            ready_state = await page.evaluate("document.readyState")
            print(f"   加载状态: {ready_state}")
        except:
            print("   加载状态: 无法获取")
        
        # 检查是否有错误信息
        try:
            page_text = await page.evaluate("document.body.innerText")
            if 'error' in page_text.lower() or 'oops' in page_text.lower():
                print(f"   ⚠️ 页面包含错误: {page_text[:200]}...")
            else:
                print(f"   ✅ 页面文本长度: {len(page_text)} 字符")
        except:
            print("   ❌ 无法获取页面文本")
    
    async def detailed_element_analysis(self, page, step_name):
        """详细的元素分析"""
        print(f"\n🔍 元素分析 - {step_name}")
        
        # 分析输入框
        try:
            inputs = await page.query_selector_all('input')
            print(f"   输入框数量: {len(inputs)}")
            
            for i, input_elem in enumerate(inputs[:5]):  # 只显示前5个
                try:
                    input_type = await input_elem.get_attribute('type') or 'text'
                    input_name = await input_elem.get_attribute('name') or ''
                    input_id = await input_elem.get_attribute('id') or ''
                    is_visible = await input_elem.is_visible()
                    print(f"     输入框{i+1}: type={input_type}, name={input_name}, id={input_id}, visible={is_visible}")
                except:
                    print(f"     输入框{i+1}: 无法获取属性")
        except:
            print("   ❌ 无法分析输入框")
        
        # 分析按钮
        try:
            buttons = await page.query_selector_all('button')
            print(f"   按钮数量: {len(buttons)}")
            
            for i, button in enumerate(buttons[:5]):  # 只显示前5个
                try:
                    button_text = await button.inner_text()
                    button_type = await button.get_attribute('type') or ''
                    is_visible = await button.is_visible()
                    is_enabled = await button.is_enabled()
                    print(f"     按钮{i+1}: '{button_text}', type={button_type}, visible={is_visible}, enabled={is_enabled}")
                except:
                    print(f"     按钮{i+1}: 无法获取属性")
        except:
            print("   ❌ 无法分析按钮")
        
        # 分析iframe
        try:
            iframes = await page.query_selector_all('iframe')
            print(f"   iframe数量: {len(iframes)}")
            
            for i, iframe in enumerate(iframes[:3]):  # 只显示前3个
                try:
                    src = await iframe.get_attribute('src') or ''
                    is_visible = await iframe.is_visible()
                    print(f"     iframe{i+1}: src={src[:50]}..., visible={is_visible}")
                except:
                    print(f"     iframe{i+1}: 无法获取属性")
        except:
            print("   ❌ 无法分析iframe")
    
    async def check_success_indicators(self, page):
        """检查成功指标"""
        print("\n🎯 检查成功指标...")
        
        success_patterns = ['Success!', 'success', 'SUCCESS', '成功', 'completed', 'verified']
        
        for pattern in success_patterns:
            try:
                # 检查页面文本
                page_text = await page.evaluate("document.body.innerText")
                if pattern in page_text:
                    print(f"🎉 在页面文本中发现: '{pattern}'")
                    return True
                
                # 检查HTML
                page_html = await page.content()
                if pattern in page_html:
                    print(f"🎉 在页面HTML中发现: '{pattern}'")
                    return True
                
                # 检查URL
                if pattern.lower() in page.url.lower():
                    print(f"🎉 在URL中发现: '{pattern}'")
                    return True
                    
            except Exception as e:
                print(f"   ❌ 检查'{pattern}'时出错: {e}")
                continue
        
        print("❌ 未发现任何成功指标")
        return False
    
    async def run_with_video_recording(self):
        """运行带视频录制的突破过程"""
        print(f"""
🎥 视频录制版验证码突破工具
============================================================
🚀 功能:
  • 录制整个浏览器操作过程
  • 详细的页面状态分析
  • 元素定位过程可视化
  • 失败原因分析
============================================================
开始时间: {self.start_time}
""")
        
        async with async_playwright() as p:
            # 启动浏览器，启用视频录制
            browser = await p.chromium.launch(
                headless=True,  # 使用无头模式适合服务器环境
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions'
                ]
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                record_video_dir="./videos/",  # 视频录制目录
                record_video_size={'width': 1280, 'height': 720}
            )
            
            page = await context.new_page()
            
            try:
                print("🎬 开始录制...")
                
                # 步骤1: 访问页面
                print("\n" + "="*60)
                print("📄 步骤1: 访问注册页面")
                print("="*60)
                
                await page.goto('https://augmentcode.com/signup', wait_until='networkidle', timeout=30000)
                await page.wait_for_timeout(3000)
                
                await self.log_page_state(page, "页面加载后")
                await self.detailed_element_analysis(page, "初始页面")
                await self.take_screenshot(page, "01_initial_page")
                
                # 步骤2: 填写邮箱
                print("\n" + "="*60)
                print("📧 步骤2: 填写邮箱")
                print("="*60)
                
                email_selectors = [
                    'input[name="username"]',
                    'input[name="email"]',
                    'input[type="email"]',
                    'input[type="text"]'
                ]
                
                email_filled = False
                for selector in email_selectors:
                    try:
                        print(f"   🔍 尝试选择器: {selector}")
                        email_input = await page.query_selector(selector)
                        
                        if email_input:
                            is_visible = await email_input.is_visible()
                            is_enabled = await email_input.is_enabled()
                            print(f"   ✅ 找到元素: visible={is_visible}, enabled={is_enabled}")
                            
                            if is_visible and is_enabled:
                                print(f"   📝 填写邮箱: {self.test_email}")
                                await email_input.click()
                                await page.wait_for_timeout(1000)
                                await email_input.fill(self.test_email)
                                await page.wait_for_timeout(2000)
                                
                                # 验证填写结果
                                filled_value = await email_input.input_value()
                                print(f"   ✅ 填写完成，当前值: {filled_value}")
                                email_filled = True
                                break
                        else:
                            print(f"   ❌ 未找到元素: {selector}")
                            
                    except Exception as e:
                        print(f"   ❌ 选择器 {selector} 失败: {e}")
                        continue
                
                if not email_filled:
                    print("❌ 所有邮箱选择器都失败了")
                    await self.detailed_element_analysis(page, "邮箱填写失败后")
                    await self.take_screenshot(page, "02_email_fill_failed")
                else:
                    await self.take_screenshot(page, "02_email_filled")
                
                await self.log_page_state(page, "邮箱填写后")
                
                # 步骤3: 点击Continue按钮
                print("\n" + "="*60)
                print("🔘 步骤3: 点击Continue按钮")
                print("="*60)
                
                continue_selectors = [
                    'button[type="submit"]',
                    'button[data-action-button-primary="true"]',
                    'button:has-text("Continue")',
                    'button:has-text("继续")',
                    'input[type="submit"]'
                ]
                
                continue_clicked = False
                for selector in continue_selectors:
                    try:
                        print(f"   🔍 尝试选择器: {selector}")
                        button = await page.query_selector(selector)
                        
                        if button:
                            is_visible = await button.is_visible()
                            is_enabled = await button.is_enabled()
                            button_text = await button.inner_text() if is_visible else "无法获取文本"
                            print(f"   ✅ 找到按钮: '{button_text}', visible={is_visible}, enabled={is_enabled}")
                            
                            if is_visible and is_enabled:
                                print(f"   👆 点击按钮: {selector}")
                                await button.click()
                                await page.wait_for_timeout(5000)
                                print(f"   ✅ 按钮点击完成")
                                continue_clicked = True
                                break
                        else:
                            print(f"   ❌ 未找到按钮: {selector}")
                            
                    except Exception as e:
                        print(f"   ❌ 按钮 {selector} 失败: {e}")
                        continue
                
                if not continue_clicked:
                    print("❌ 所有Continue按钮选择器都失败了")
                    print("🔄 尝试按Enter键...")
                    await page.keyboard.press('Enter')
                    await page.wait_for_timeout(3000)
                
                await self.log_page_state(page, "Continue按钮点击后")
                await self.detailed_element_analysis(page, "Continue按钮点击后")
                await self.take_screenshot(page, "03_after_continue")
                
                # 步骤4: 等待并检查验证码
                print("\n" + "="*60)
                print("🎯 步骤4: 等待并检查验证码")
                print("="*60)
                
                # 等待验证码加载
                for i in range(20):  # 等待20秒
                    await page.wait_for_timeout(1000)
                    
                    if (i + 1) % 5 == 0:
                        print(f"   ⏳ 已等待 {i + 1} 秒...")
                        await self.log_page_state(page, f"等待{i+1}秒后")
                        
                        # 检查验证码
                        captcha_selectors = [
                            '.ulp-captcha',
                            '.cf-turnstile',
                            '.g-recaptcha',
                            '.h-captcha',
                            'iframe[src*="turnstile"]',
                            'iframe[src*="recaptcha"]',
                            'iframe[src*="hcaptcha"]'
                        ]
                        
                        for selector in captcha_selectors:
                            try:
                                captcha = await page.query_selector(selector)
                                if captcha and await captcha.is_visible():
                                    print(f"   🎯 发现验证码: {selector}")
                                    await self.take_screenshot(page, f"04_captcha_found_{i+1}s")
                                    
                                    # 尝试点击验证码
                                    print(f"   👆 点击验证码...")
                                    await captcha.click()
                                    await page.wait_for_timeout(3000)
                                    
                                    # 检查是否成功
                                    if await self.check_success_indicators(page):
                                        await self.take_screenshot(page, f"05_success_{i+1}s")
                                        print("🎉 验证码处理成功!")
                                        return True
                                    
                                    break
                            except Exception as e:
                                print(f"   ❌ 处理验证码 {selector} 失败: {e}")
                                continue
                        
                        # 检查是否有成功指标
                        if await self.check_success_indicators(page):
                            await self.take_screenshot(page, f"06_success_detected_{i+1}s")
                            print("🎉 发现成功指标!")
                            return True
                
                # 最终状态
                print("\n" + "="*60)
                print("📊 最终状态分析")
                print("="*60)
                
                await self.log_page_state(page, "最终状态")
                await self.detailed_element_analysis(page, "最终状态")
                await self.take_screenshot(page, "07_final_state")
                
                # 最后检查
                if await self.check_success_indicators(page):
                    print("🎉 最终检查发现成功!")
                    return True
                else:
                    print("❌ 未发现成功指标")
                    return False
                
            except Exception as e:
                print(f"❌ 执行过程中出错: {e}")
                await self.take_screenshot(page, "error")
                return False
            
            finally:
                # 停止录制
                print("\n🎬 停止录制...")
                await page.wait_for_timeout(2000)  # 等待2秒确保录制完整
                await browser.close()
                
                # 查找生成的视频文件
                video_files = []
                if os.path.exists("./videos/"):
                    for file in os.listdir("./videos/"):
                        if file.endswith('.webm'):
                            video_files.append(os.path.join("./videos/", file))
                
                if video_files:
                    latest_video = max(video_files, key=os.path.getctime)
                    file_size = os.path.getsize(latest_video)
                    print(f"🎥 视频文件: {latest_video}")
                    print(f"📁 文件大小: {file_size / 1024 / 1024:.2f} MB")
                    
                    # 重命名为更有意义的名称
                    new_name = f"captcha_breakthrough_{self.start_time}.webm"
                    os.rename(latest_video, new_name)
                    print(f"📝 重命名为: {new_name}")
                else:
                    print("⚠️ 未找到视频文件")

async def main():
    breaker = VideoRecorderCaptchaBreaker()
    success = await breaker.run_with_video_recording()
    
    if success:
        print("\n🎊🎊🎊 任务成功完成!")
    else:
        print("\n❌ 任务未完成，但已生成详细的视频和截图记录")
    
    print("\n📋 生成的文件:")
    for file in os.listdir('.'):
        if file.startswith('video_debug_') or file.startswith('captcha_breakthrough_'):
            print(f"   📁 {file}")

if __name__ == "__main__":
    asyncio.run(main())
