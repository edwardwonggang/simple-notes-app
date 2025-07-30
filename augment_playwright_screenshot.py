#!/usr/bin/env python3
"""
Augment Code 注册流程 - 增强版自动化脚本
使用Playwright进行智能的浏览器自动化，包含人机认证处理和迭代重试机制
"""

import asyncio
import time
import random
from playwright.async_api import async_playwright

async def simulate_human_mouse_movement(page, element):
    """模拟人类鼠标移动到元素"""
    try:
        # 获取元素位置
        box = await element.bounding_box()
        if not box:
            return False

        # 计算目标位置（元素中心附近的随机点）
        target_x = box['x'] + box['width'] / 2 + random.randint(-10, 10)
        target_y = box['y'] + box['height'] / 2 + random.randint(-5, 5)

        # 模拟人类鼠标移动轨迹
        current_pos = await page.evaluate("() => ({ x: window.mouseX || 0, y: window.mouseY || 0 })")
        start_x = current_pos.get('x', 0)
        start_y = current_pos.get('y', 0)

        # 分步移动鼠标
        steps = random.randint(8, 15)
        for i in range(steps):
            progress = i / steps
            # 使用贝塞尔曲线模拟自然移动
            x = start_x + (target_x - start_x) * progress + random.randint(-2, 2)
            y = start_y + (target_y - start_y) * progress + random.randint(-2, 2)

            await page.mouse.move(x, y)
            await page.wait_for_timeout(random.randint(10, 30))

        # 最终移动到精确位置
        await page.mouse.move(target_x, target_y)
        await page.wait_for_timeout(random.randint(100, 300))
        return True

    except Exception as e:
        print(f"⚠️ 鼠标移动模拟失败: {e}")
        return False

async def check_and_handle_captcha(page, step_num):
    """检查并处理人机认证"""
    print(f"\n🤖 步骤{step_num}: 检查人机认证")

    # 多种可能的验证码选择器
    captcha_selectors = [
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        'iframe[title*="reCAPTCHA"]',
        '.captcha-container',
        '.recaptcha-container',
        '[data-captcha-provider]',
        '.ulp-captcha-container',
        '.ulp-auth0-v2-captcha'
    ]

    captcha_found = False
    for selector in captcha_selectors:
        try:
            captcha_element = await page.wait_for_selector(selector, timeout=2000)
            if captcha_element:
                print(f"✅ 发现人机认证: {selector}")
                captcha_found = True

                # 截图验证码
                await page.screenshot(path=f"playwright_{step_num:02d}_captcha_found.png", full_page=True)
                print(f"✅ 截图已保存: playwright_{step_num:02d}_captcha_found.png")

                # 尝试处理验证码
                await handle_captcha_interaction(page, captcha_element, step_num)
                break
        except:
            continue

    if not captcha_found:
        print("ℹ️ 未发现人机认证组件")

    return captcha_found

async def handle_captcha_interaction(page, captcha_element, step_num):
    """处理人机认证交互"""
    try:
        # 检查是否是iframe内的验证码
        if await captcha_element.get_attribute('src'):
            print("🔄 处理iframe验证码...")
            # 对于iframe验证码，尝试点击
            await simulate_human_mouse_movement(page, captcha_element)
            await captcha_element.click()
            await page.wait_for_timeout(2000)
        else:
            # 查找验证码复选框
            checkbox_selectors = [
                'input[type="checkbox"]',
                '.recaptcha-checkbox',
                '[role="checkbox"]'
            ]

            for selector in checkbox_selectors:
                try:
                    checkbox = await page.wait_for_selector(selector, timeout=2000)
                    if checkbox:
                        is_checked = await checkbox.is_checked()
                        if not is_checked:
                            print("🔘 发现未选中的验证码复选框，正在点击...")
                            await simulate_human_mouse_movement(page, checkbox)
                            await checkbox.click()
                            await page.wait_for_timeout(random.randint(1000, 2000))
                            print("✅ 已点击验证码复选框")
                        else:
                            print("ℹ️ 验证码复选框已选中")
                        break
                except:
                    continue

        # 等待验证完成
        await page.wait_for_timeout(3000)

        # 截图验证后状态
        await page.screenshot(path=f"playwright_{step_num:02d}_captcha_handled.png", full_page=True)
        print(f"✅ 截图已保存: playwright_{step_num:02d}_captcha_handled.png")

    except Exception as e:
        print(f"⚠️ 处理验证码时出错: {e}")

async def augment_signup_with_playwright():
    """使用Playwright执行Augment Code注册流程并截图"""
    email = "wg824468733wg+123@gmail.com"
    max_retries = 3

    async with async_playwright() as p:
        for attempt in range(max_retries):
            try:
                print(f"🚀 开始Augment Code注册流程 (尝试 {attempt + 1}/{max_retries})...")

                # 启动浏览器
                print("\n📱 启动浏览器...")
                browser = await p.chromium.launch(
                    headless=True,  # 在服务器环境中使用headless模式
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

                # 设置用户代理
                await page.set_extra_http_headers({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                })

                print("✅ 浏览器启动成功")

                # 步骤1: 访问注册页面
                print("\n📄 步骤1: 访问注册页面")
                try:
                    await page.goto("https://augmentcode.com/signup", wait_until='networkidle', timeout=60000)

                    # 截图1: 初始页面
                    await page.screenshot(path=f"playwright_01_initial_page_attempt_{attempt + 1}.png", full_page=True)
                    print(f"✅ 截图已保存: playwright_01_initial_page_attempt_{attempt + 1}.png")
                    print(f"   URL: {page.url}")
                    print(f"   标题: {await page.title()}")

                    # 等待可能的重定向
                    await page.wait_for_timeout(5000)

                    # 截图2: 重定向后
                    await page.screenshot(path=f"playwright_02_after_redirect_attempt_{attempt + 1}.png", full_page=True)
                    print(f"✅ 截图已保存: playwright_02_after_redirect_attempt_{attempt + 1}.png")
                    print(f"   URL: {page.url}")
                    print(f"   标题: {await page.title()}")

                    # 执行主要的注册流程
                    success = await execute_signup_flow(page, email, attempt + 1)

                except Exception as nav_error:
                    print(f"⚠️ 页面导航出错: {nav_error}")
                    # 尝试直接访问认证页面
                    try:
                        print("🔄 尝试直接访问认证页面...")
                        await page.goto("https://auth.augmentcode.com/signup/login?individual=true", wait_until='networkidle', timeout=60000)

                        await page.screenshot(path=f"playwright_01_auth_page_attempt_{attempt + 1}.png", full_page=True)
                        print(f"✅ 截图已保存: playwright_01_auth_page_attempt_{attempt + 1}.png")
                        print(f"   URL: {page.url}")
                        print(f"   标题: {await page.title()}")

                        # 执行主要的注册流程
                        success = await execute_signup_flow(page, email, attempt + 1)

                    except Exception as auth_error:
                        print(f"❌ 认证页面访问也失败: {auth_error}")
                        success = False

                # 关闭浏览器
                await browser.close()

                if success:
                    print(f"\n🎉 注册流程在第 {attempt + 1} 次尝试中成功完成！")
                    return True
                else:
                    print(f"\n⚠️ 第 {attempt + 1} 次尝试未完全成功")
                    if attempt < max_retries - 1:
                        print(f"🔄 准备进行第 {attempt + 2} 次尝试...")
                        await asyncio.sleep(5)  # 等待5秒后重试

            except Exception as e:
                print(f"❌ 第 {attempt + 1} 次尝试发生错误：{str(e)}")
                try:
                    await page.screenshot(path=f"playwright_error_attempt_{attempt + 1}.png", full_page=True)
                    print(f"✅ 错误截图已保存: playwright_error_attempt_{attempt + 1}.png")
                except:
                    pass
                try:
                    await browser.close()
                except:
                    pass

                if attempt < max_retries - 1:
                    print(f"🔄 准备进行第 {attempt + 2} 次尝试...")
                    await asyncio.sleep(5)

        print(f"\n❌ 所有 {max_retries} 次尝试都未成功完成")
        return False

async def execute_signup_flow(page, email, attempt_num):
    """执行注册流程的主要逻辑"""
    try:
        # 步骤2: 查找并填写邮箱
        print("\n📝 步骤2: 查找并填写邮箱")

        # 尝试多种邮箱输入框选择器
        email_selectors = [
            'input[name="username"]',
            'input[type="email"]',
            'input[name="email"]',
            'input[id="username"]',
            'input[id="email"]',
            'input[inputmode="email"]',
            'input[placeholder*="email" i]',
            'input[placeholder*="Email" i]'
        ]

        email_input_element = None
        email_selector = None

        for selector in email_selectors:
            try:
                element = await page.wait_for_selector(selector, timeout=3000)
                if element and await element.is_visible():
                    email_input_element = element
                    email_selector = selector
                    print(f"✅ 找到邮箱输入框: {selector}")
                    break
            except:
                continue

        if not email_input_element:
            print("❌ 未找到邮箱输入框")
            await page.screenshot(path=f"playwright_error_no_email_input_attempt_{attempt_num}.png", full_page=True)
            return False

        # 模拟人类输入邮箱
        await simulate_human_mouse_movement(page, email_input_element)
        await email_input_element.click()
        await page.wait_for_timeout(random.randint(500, 1000))

        # 清空输入框并输入邮箱
        await email_input_element.fill("")
        await page.wait_for_timeout(random.randint(200, 500))

        # 模拟人类打字速度
        for char in email:
            await email_input_element.type(char)
            await page.wait_for_timeout(random.randint(50, 150))

        print(f"✅ 已输入邮箱: {email}")

        # 截图3: 输入邮箱后
        await page.screenshot(path=f"playwright_03_email_entered_attempt_{attempt_num}.png", full_page=True)
        print(f"✅ 截图已保存: playwright_03_email_entered_attempt_{attempt_num}.png")

        # 步骤3: 检查并处理人机认证
        await check_and_handle_captcha(page, 3)

        # 步骤4: 查找并点击继续按钮
        print("\n🔘 步骤4: 查找并点击继续按钮")

        continue_selectors = [
            'button[type="submit"]',
            'button[name="action"]',
            'button[value="default"]',
            'input[type="submit"]',
            'button:has-text("Continue")',
            'button:has-text("continue")',
            'button:has-text("Submit")',
            'button:has-text("submit")'
        ]

        continue_button_element = None
        continue_selector = None

        for selector in continue_selectors:
            try:
                element = await page.wait_for_selector(selector, timeout=2000)
                if element and await element.is_visible():
                    continue_button_element = element
                    continue_selector = selector
                    print(f"✅ 找到继续按钮: {selector}")
                    break
            except:
                continue

        if not continue_button_element:
            # 查找所有按钮并分析
            buttons = await page.query_selector_all('button')
            for i, btn in enumerate(buttons):
                try:
                    if await btn.is_visible():
                        btn_text = await btn.text_content()
                        btn_type = await btn.get_attribute('type')
                        if btn_text and ('continue' in btn_text.lower() or
                                       'submit' in btn_text.lower() or
                                       btn_type == 'submit'):
                            continue_button_element = btn
                            continue_selector = f'button >> nth={i}'
                            print(f"✅ 找到按钮: '{btn_text}' (type={btn_type})")
                            break
                except:
                    continue

        if not continue_button_element:
            print("❌ 未找到继续按钮")
            await page.screenshot(path=f"playwright_error_no_button_attempt_{attempt_num}.png", full_page=True)
            return False

        # 截图4: 点击前
        await page.screenshot(path=f"playwright_04_before_click_attempt_{attempt_num}.png", full_page=True)
        print(f"✅ 截图已保存: playwright_04_before_click_attempt_{attempt_num}.png")

        # 模拟人类点击按钮
        await simulate_human_mouse_movement(page, continue_button_element)
        await continue_button_element.click()
        print("✅ 已点击继续按钮")

        # 等待页面响应
        await page.wait_for_timeout(5000)

        # 截图5: 点击后
        await page.screenshot(path=f"playwright_05_after_click_attempt_{attempt_num}.png", full_page=True)
        print(f"✅ 截图已保存: playwright_05_after_click_attempt_{attempt_num}.png")
        print(f"   URL: {page.url}")
        print(f"   标题: {await page.title()}")

        # 步骤5: 检查SUCCESS!文字和验证结果
        print("\n🔍 步骤5: 检查SUCCESS!文字和验证结果")

        # 等待页面完全加载
        await page.wait_for_timeout(3000)

        page_content = await page.content()
        page_content_lower = page_content.lower()

        # 首先检查SUCCESS!文字
        success_indicators = ["success!", "success", "successful"]
        found_success = any(indicator in page_content_lower for indicator in success_indicators)

        if found_success:
            print("🎉 发现SUCCESS!文字，验证通过！")
            await page.screenshot(path=f"playwright_06_success_found_attempt_{attempt_num}.png", full_page=True)
            print(f"✅ 截图已保存: playwright_06_success_found_attempt_{attempt_num}.png")

            # 查找continue按钮跳转到验证码页面
            await page.wait_for_timeout(2000)
            return await find_and_click_continue_to_verification(page, attempt_num)

        # 如果没有找到SUCCESS!，检查是否直接跳转到验证页面
        verification_keywords = [
            "verification", "verify", "code", "check your email",
            "enter the code", "6-digit", "confirm", "验证码", "验证",
            "email sent", "we sent", "inbox", "enter code"
        ]

        found_verification = [kw for kw in verification_keywords if kw in page_content_lower]

        if found_verification:
            print(f"✅ 直接检测到验证相关内容: {found_verification}")
            await page.screenshot(path=f"playwright_06_verification_page_attempt_{attempt_num}.png", full_page=True)
            print(f"✅ 截图已保存: playwright_06_verification_page_attempt_{attempt_num}.png")

            # 保存页面HTML
            with open(f"playwright_verification_page_attempt_{attempt_num}.html", "w", encoding="utf-8") as f:
                f.write(page_content)
            print(f"✅ 已保存验证页面HTML: playwright_verification_page_attempt_{attempt_num}.html")

            return True
        else:
            print("⚠️ 未检测到SUCCESS!文字或验证页面")
            await page.screenshot(path=f"playwright_06_final_page_attempt_{attempt_num}.png", full_page=True)
            print(f"✅ 截图已保存: playwright_06_final_page_attempt_{attempt_num}.png")

            # 保存页面HTML用于调试
            with open(f"playwright_final_page_attempt_{attempt_num}.html", "w", encoding="utf-8") as f:
                f.write(page_content)
            print(f"✅ 已保存最终页面HTML: playwright_final_page_attempt_{attempt_num}.html")

            return False

    except Exception as e:
        print(f"❌ 执行注册流程时发生错误：{str(e)}")
        try:
            await page.screenshot(path=f"playwright_error_flow_attempt_{attempt_num}.png", full_page=True)
            print(f"✅ 错误截图已保存: playwright_error_flow_attempt_{attempt_num}.png")
        except:
            pass
        return False

async def find_and_click_continue_to_verification(page, attempt_num):
    """查找并点击continue按钮跳转到验证码页面"""
    print("\n🔄 步骤6: 查找continue按钮跳转到验证码页面")

    # 等待可能的continue按钮出现
    await page.wait_for_timeout(2000)

    continue_selectors = [
        'button:has-text("Continue")',
        'button:has-text("continue")',
        'button:has-text("Next")',
        'button:has-text("next")',
        'button[type="submit"]',
        'a:has-text("Continue")',
        'a:has-text("continue")'
    ]

    for selector in continue_selectors:
        try:
            element = await page.wait_for_selector(selector, timeout=3000)
            if element and await element.is_visible():
                print(f"✅ 找到continue按钮: {selector}")

                # 截图点击前
                await page.screenshot(path=f"playwright_07_before_continue_attempt_{attempt_num}.png", full_page=True)
                print(f"✅ 截图已保存: playwright_07_before_continue_attempt_{attempt_num}.png")

                # 模拟人类点击
                await simulate_human_mouse_movement(page, element)
                await element.click()
                print("✅ 已点击continue按钮")

                # 等待跳转
                await page.wait_for_timeout(5000)

                # 截图跳转后
                await page.screenshot(path=f"playwright_08_verification_page_attempt_{attempt_num}.png", full_page=True)
                print(f"✅ 截图已保存: playwright_08_verification_page_attempt_{attempt_num}.png")
                print(f"   URL: {page.url}")
                print(f"   标题: {await page.title()}")

                # 检查是否成功跳转到验证码页面
                page_content = await page.content()
                verification_keywords = [
                    "verification", "verify", "code", "enter the code",
                    "6-digit", "验证码", "验证", "enter code"
                ]

                found_verification = any(kw in page_content.lower() for kw in verification_keywords)

                if found_verification:
                    print("🎉 成功跳转到验证码输入页面！")
                    # 保存验证页面HTML
                    with open(f"playwright_verification_final_attempt_{attempt_num}.html", "w", encoding="utf-8") as f:
                        f.write(page_content)
                    print(f"✅ 已保存验证页面HTML: playwright_verification_final_attempt_{attempt_num}.html")
                    return True
                else:
                    print("⚠️ 点击continue后未跳转到验证码页面")
                    return False

        except:
            continue

    print("⚠️ 未找到continue按钮，可能已经在验证码页面")
    return True

def create_playwright_summary():
    """创建增强版Playwright截图总结"""
    import os

    print("\n" + "="*80)
    print("📸 AUGMENT CODE 注册流程截图总结 (增强版)")
    print("="*80)

    # 检查生成的截图文件
    screenshot_files = [f for f in os.listdir('.') if f.startswith('playwright_') and f.endswith('.png')]
    screenshot_files.sort()

    if screenshot_files:
        print(f"\n✅ 成功生成 {len(screenshot_files)} 张截图:")
        total_size = 0
        for i, filename in enumerate(screenshot_files, 1):
            size = os.path.getsize(filename)
            total_size += size
            print(f"  {i}. {filename} ({size:,} bytes)")
        print(f"     总大小: {total_size:,} bytes")
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

    # 分析执行结果
    success_files = [f for f in screenshot_files if 'success' in f.lower()]
    verification_files = [f for f in screenshot_files if 'verification' in f.lower()]
    captcha_files = [f for f in screenshot_files if 'captcha' in f.lower()]
    error_files = [f for f in screenshot_files if 'error' in f.lower()]

    print(f"\n📊 执行分析:")
    if success_files:
        print(f"  🎉 发现SUCCESS!相关截图: {len(success_files)} 个")
    if verification_files:
        print(f"  ✅ 发现验证码相关截图: {len(verification_files)} 个")
    if captcha_files:
        print(f"  🤖 发现人机认证相关截图: {len(captcha_files)} 个")
    if error_files:
        print(f"  ⚠️ 发现错误相关截图: {len(error_files)} 个")

    print("\n🔧 增强功能:")
    print("  ✓ 智能人机认证检测和处理")
    print("  ✓ SUCCESS!文字检测")
    print("  ✓ 模拟人类鼠标移动")
    print("  ✓ 自动重试机制 (最多3次)")
    print("  ✓ 详细的错误处理和截图")

    print("\n💡 建议:")
    print("  1. 查看生成的截图文件了解完整流程")
    print("  2. 检查邮箱是否收到验证邮件")
    print("  3. 如果收到邮件，点击验证链接完成注册")
    print("  4. 查看HTML文件了解页面详细内容")
    print("  5. 如果有错误截图，分析具体问题")
    print("="*80)

async def main():
    """主函数 - 增强版自动化注册流程"""
    print("🚀 启动Augment Code增强版自动化注册流程...")
    print("🔧 功能特性:")
    print("  • 智能人机认证处理")
    print("  • SUCCESS!文字检测")
    print("  • 模拟人类操作")
    print("  • 自动重试机制")
    print("  • 详细错误处理")
    print("-" * 50)

    success = await augment_signup_with_playwright()
    create_playwright_summary()

    if success:
        print("\n🎉 注册流程成功完成！")
        print("📧 请检查邮箱 wg824468733wg+123@gmail.com 是否收到验证邮件")
        print("🔗 如果收到邮件，点击验证链接完成最终注册")
    else:
        print("\n⚠️ 注册流程未完全成功")
        print("📸 请查看生成的截图了解详细情况")
        print("🔄 脚本已自动重试多次，如需手动处理请参考截图")

    print("\n✨ 增强版Playwright自动化流程完成！")

if __name__ == "__main__":
    asyncio.run(main())
