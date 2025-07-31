#!/usr/bin/env python3
"""
🎯 直接Success检测器
简化版本，专注于核心功能
"""

import asyncio
from playwright.async_api import async_playwright
import os
import sys

async def main():
    print("""
🎯 直接Success检测器
============================================================
🚀 目标: 严格检测"Success!"字样（大小写完全匹配）
============================================================
""")
    
    # 清理旧截图
    print("🧹 清理旧截图...")
    for file in os.listdir('.'):
        if file.startswith('iteration_') and file.endswith('.png'):
            try:
                os.remove(file)
                print(f"   删除: {file}")
            except:
                pass
    
    iteration = 1
    max_iterations = 10
    test_email = 'wg824468733wg+123@gmail.com'
    success_pattern = 'Success!'
    
    while iteration <= max_iterations:
        print(f"\n🔄 第 {iteration} 轮迭代开始...")
        
        try:
            async with async_playwright() as p:
                print("   🚀 启动浏览器...")
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # 1. 访问页面
                print("   📄 访问Auth0登录页面...")
                await page.goto('https://login.augmentcode.com/u/login/identifier', timeout=30000)
                await page.wait_for_timeout(3000)
                
                current_url = page.url
                page_title = await page.title()
                print(f"      当前URL: {current_url}")
                print(f"      页面标题: {page_title}")
                
                # 截图1
                filename1 = f"iteration_{iteration:03d}_01_initial.png"
                await page.screenshot(path=filename1)
                print(f"   📸 截图: {filename1}")
                
                # 2. 查找邮箱输入框
                print("   📧 查找邮箱输入框...")
                email_input = None
                email_selectors = ['input[name="username"]', 'input[type="email"]', 'input[type="text"]']
                
                for selector in email_selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=5000)
                        element = await page.query_selector(selector)
                        if element and await element.is_visible():
                            email_input = element
                            print(f"      ✅ 找到邮箱输入框: {selector}")
                            break
                    except:
                        continue
                
                if not email_input:
                    print("      ❌ 未找到邮箱输入框")
                    await browser.close()
                    iteration += 1
                    continue
                
                # 3. 填写邮箱
                print(f"   📝 填写邮箱: {test_email}")
                await email_input.click()
                await page.wait_for_timeout(1000)
                await email_input.fill(test_email)
                await page.wait_for_timeout(2000)
                
                # 截图2
                filename2 = f"iteration_{iteration:03d}_02_email_filled.png"
                await page.screenshot(path=filename2)
                print(f"   📸 截图: {filename2}")
                
                # 4. 查找Continue按钮
                print("   🔘 查找Continue按钮...")
                continue_button = None
                continue_selectors = ['button[type="submit"]', 'button[data-action-button-primary="true"]']
                
                for selector in continue_selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=5000)
                        element = await page.query_selector(selector)
                        if element and await element.is_visible():
                            continue_button = element
                            print(f"      ✅ 找到Continue按钮: {selector}")
                            break
                    except:
                        continue
                
                if continue_button:
                    print("   👆 点击Continue按钮...")
                    await continue_button.click()
                    await page.wait_for_timeout(5000)
                else:
                    print("   ❌ 未找到Continue按钮，按Enter键...")
                    await page.keyboard.press('Enter')
                    await page.wait_for_timeout(5000)
                
                # 截图3
                filename3 = f"iteration_{iteration:03d}_03_after_continue.png"
                await page.screenshot(path=filename3)
                print(f"   📸 截图: {filename3}")
                
                # 5. 等待40秒并检测Success!
                print("   ⏰ 等待40秒并检测Success!...")
                for i in range(40):
                    await page.wait_for_timeout(1000)
                    
                    if (i + 1) % 10 == 0:
                        print(f"      ⏳ 已等待 {i + 1} 秒...")
                        
                        # 检查Success!
                        try:
                            page_text = await page.evaluate("document.body.innerText")
                            page_html = await page.content()
                            page_title = await page.title()
                            
                            if success_pattern in page_text or success_pattern in page_html or success_pattern in page_title:
                                filename_success = f"iteration_{iteration:03d}_04_SUCCESS_at_{i+1}s.png"
                                await page.screenshot(path=filename_success)
                                print(f"🎉🎉🎉 SUCCESS! 在第{i+1}秒发现'{success_pattern}'字样!")
                                print(f"📸 成功截图: {filename_success}")
                                await browser.close()
                                
                                # 自动提交成功结果
                                print("\n📤 自动提交成功结果到GitHub...")
                                return True
                        except:
                            pass
                
                # 6. 最终截图
                filename4 = f"iteration_{iteration:03d}_04_final.png"
                await page.screenshot(path=filename4)
                print(f"   📸 最终截图: {filename4}")
                
                # 7. 最终检查
                print("   🔍 最终检查Success!...")
                try:
                    page_text = await page.evaluate("document.body.innerText")
                    page_html = await page.content()
                    page_title = await page.title()
                    
                    if success_pattern in page_text or success_pattern in page_html or success_pattern in page_title:
                        filename_final_success = f"iteration_{iteration:03d}_05_FINAL_SUCCESS.png"
                        await page.screenshot(path=filename_final_success)
                        print(f"🎉🎉🎉 SUCCESS! 最终检查发现'{success_pattern}'字样!")
                        print(f"📸 成功截图: {filename_final_success}")
                        await browser.close()
                        
                        # 自动提交成功结果
                        print("\n📤 自动提交成功结果到GitHub...")
                        return True
                    else:
                        print(f"      ❌ 未发现'{success_pattern}'字样")
                except Exception as e:
                    print(f"      ❌ 检查失败: {e}")
                
                await browser.close()
                print(f"   ❌ 第 {iteration} 轮迭代未成功")
                
        except Exception as e:
            print(f"   ❌ 第 {iteration} 轮迭代出错: {e}")
        
        iteration += 1
        if iteration <= max_iterations:
            print("   😴 休息3秒后继续...")
            await asyncio.sleep(3)
    
    print(f"\n⚠️ 达到最大迭代次数 {max_iterations}，未找到Success!字样")
    return False

if __name__ == "__main__":
    result = asyncio.run(main())
    if result:
        print("\n🎊 任务圆满完成！")
        sys.exit(0)
    else:
        print("\n❌ 任务未完成")
        sys.exit(1)
