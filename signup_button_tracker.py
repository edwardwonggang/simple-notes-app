#!/usr/bin/env python3
"""
🎯 Sign up按钮追踪器
追踪主站的Sign up按钮，看看它会跳转到哪里
"""

import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    print("🎯 Sign up按钮追踪器")
    print("============================================================")
    
    # 清理旧截图
    print("🧹 清理旧截图...")
    for file in os.listdir('.'):
        if file.startswith('iteration_') and file.endswith('.png'):
            try:
                os.remove(file)
                print(f"   删除: {file}")
            except:
                pass
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # 1. 访问主站
            print("\n📄 访问主站...")
            await page.goto('https://augmentcode.com/', timeout=30000)
            await page.wait_for_timeout(3000)
            
            current_url = page.url
            page_title = await page.title()
            print(f"   当前URL: {current_url}")
            print(f"   页面标题: {page_title}")
            
            # 截图1: 主站
            await page.screenshot(path='iteration_001_01_homepage.png', full_page=True)
            print("   📸 截图: iteration_001_01_homepage.png")
            
            # 2. 查找Sign up按钮
            print("\n🔍 查找Sign up按钮...")
            signup_selectors = [
                'button:has-text("Sign up")',
                'a:has-text("Sign up")',
                'button:has-text("signup")',
                'a:has-text("signup")',
                'button:has-text("注册")',
                'a:has-text("注册")',
                '[href*="signup"]',
                '[href*="register"]'
            ]
            
            signup_button = None
            for selector in signup_selectors:
                try:
                    element = await page.query_selector(selector)
                    if element and await element.is_visible():
                        button_text = await element.inner_text()
                        print(f"   ✅ 找到Sign up按钮: {selector}")
                        print(f"      按钮文本: {button_text}")
                        signup_button = element
                        break
                except:
                    continue
            
            if not signup_button:
                print("   ❌ 未找到Sign up按钮")
                
                # 列出所有可见的按钮
                print("\n🔍 列出所有可见按钮:")
                all_buttons = await page.query_selector_all('button, a')
                for i, button in enumerate(all_buttons):
                    try:
                        if await button.is_visible():
                            text = await button.inner_text()
                            href = await button.get_attribute('href')
                            if text.strip():
                                print(f"      按钮 {i}: '{text}' (href: {href})")
                    except:
                        continue
                
                await browser.close()
                return
            
            # 3. 点击Sign up按钮
            print("\n👆 点击Sign up按钮...")
            await signup_button.click()
            await page.wait_for_timeout(5000)
            
            new_url = page.url
            new_title = await page.title()
            print(f"   跳转后URL: {new_url}")
            print(f"   跳转后标题: {new_title}")
            
            # 截图2: 点击后
            await page.screenshot(path='iteration_001_02_after_signup_click.png', full_page=True)
            print("   📸 截图: iteration_001_02_after_signup_click.png")
            
            # 4. 分析新页面
            print("\n🔍 分析新页面...")
            page_text = await page.evaluate("document.body.innerText")
            print(f"   页面文本长度: {len(page_text)} 字符")
            
            # 检查是否有错误
            if 'error' in page_text.lower() or 'oops' in page_text.lower():
                print("   ❌ 页面包含错误信息")
                print(f"   错误内容: {page_text[:300]}")
            else:
                print("   ✅ 页面看起来正常")
            
            # 查找输入框
            all_inputs = await page.query_selector_all('input')
            print(f"   找到 {len(all_inputs)} 个输入框")
            
            email_inputs = []
            for i, input_elem in enumerate(all_inputs):
                try:
                    input_type = await input_elem.get_attribute('type') or 'text'
                    input_name = await input_elem.get_attribute('name') or ''
                    input_id = await input_elem.get_attribute('id') or ''
                    input_placeholder = await input_elem.get_attribute('placeholder') or ''
                    is_visible = await input_elem.is_visible()
                    
                    if is_visible:
                        print(f"      输入框 {i}: type={input_type}, name={input_name}, id={input_id}, placeholder={input_placeholder}")
                        
                        if (input_type in ['email', 'text'] and 
                            ('email' in input_name.lower() or 'username' in input_name.lower() or 
                             'email' in input_id.lower() or 'username' in input_id.lower() or
                             'email' in input_placeholder.lower())):
                            email_inputs.append(input_elem)
                            print(f"         ✅ 这可能是邮箱输入框!")
                except:
                    continue
            
            # 如果找到了邮箱输入框，尝试填写
            if email_inputs:
                print(f"\n📧 尝试填写邮箱 (找到 {len(email_inputs)} 个可能的邮箱输入框)...")
                
                for i, email_input in enumerate(email_inputs):
                    try:
                        print(f"   尝试填写输入框 {i}...")
                        await email_input.click()
                        await page.wait_for_timeout(1000)
                        await email_input.fill('wg824468733wg+123@gmail.com')
                        await page.wait_for_timeout(2000)
                        print(f"   ✅ 邮箱填写成功!")
                        
                        # 截图3: 邮箱填写后
                        await page.screenshot(path=f'iteration_001_03_email_filled_{i}.png', full_page=True)
                        print(f"   📸 截图: iteration_001_03_email_filled_{i}.png")
                        
                        # 等待40秒观察
                        print("   ⏰ 等待40秒观察页面变化...")
                        for j in range(40):
                            await page.wait_for_timeout(1000)
                            
                            if (j + 1) % 10 == 0:
                                print(f"      ⏳ 已等待 {j + 1} 秒...")
                                
                                # 检查Success!
                                try:
                                    page_text_check = await page.evaluate("document.body.innerText")
                                    page_html_check = await page.content()
                                    
                                    if 'Success!' in page_text_check or 'Success!' in page_html_check:
                                        await page.screenshot(path=f'iteration_001_04_SUCCESS_at_{j+1}s.png', full_page=True)
                                        print(f"🎉🎉🎉 SUCCESS! 在第{j+1}秒发现'Success!'字样!")
                                        print(f"📸 成功截图: iteration_001_04_SUCCESS_at_{j+1}s.png")
                                        await browser.close()
                                        return True
                                except:
                                    pass
                        
                        # 截图4: 等待40秒后
                        await page.screenshot(path=f'iteration_001_04_after_40s_{i}.png', full_page=True)
                        print(f"   📸 截图: iteration_001_04_after_40s_{i}.png")
                        
                        break  # 只尝试第一个有效的输入框
                        
                    except Exception as e:
                        print(f"   ❌ 填写输入框 {i} 失败: {e}")
                        continue
            
            # 最终检查
            print("\n🔍 最终检查Success!...")
            try:
                final_page_text = await page.evaluate("document.body.innerText")
                final_page_html = await page.content()
                
                if 'Success!' in final_page_text or 'Success!' in final_page_html:
                    await page.screenshot(path='iteration_001_05_FINAL_SUCCESS.png', full_page=True)
                    print("🎉🎉🎉 SUCCESS! 最终检查发现'Success!'字样!")
                    print("📸 成功截图: iteration_001_05_FINAL_SUCCESS.png")
                    await browser.close()
                    return True
                else:
                    print("   ❌ 未发现'Success!'字样")
            except:
                pass
            
            # 最终截图
            await page.screenshot(path='iteration_001_05_final.png', full_page=True)
            print("   📸 最终截图: iteration_001_05_final.png")
            
        except Exception as e:
            print(f"❌ 执行过程中出错: {e}")
            await page.screenshot(path='iteration_001_error.png', full_page=True)
            print("📸 错误截图: iteration_001_error.png")
        
        finally:
            await browser.close()
    
    print("\n❌ 未找到'Success!'字样")
    return False

if __name__ == "__main__":
    result = asyncio.run(main())
    if result:
        print("\n🎊 任务圆满完成！")
    else:
        print("\n❌ 任务未完成，但已生成详细的分析截图")
