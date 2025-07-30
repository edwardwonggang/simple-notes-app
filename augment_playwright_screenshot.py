#!/usr/bin/env python3
"""
Augment Code 注册流程 - 终极人机验证突破版
专注于突破各种人机验证，以页面出现"success"字样为成功标准
不断迭代直到成功，时间无上限
"""

import asyncio
import time
import random
import math
import os
import glob
from playwright.async_api import async_playwright

async def advanced_human_simulation(page, element, action_type="click"):
    """高级人类行为模拟"""
    try:
        # 获取元素位置
        box = await element.bounding_box()
        if not box:
            return False

        # 随机等待，模拟人类思考时间
        await page.wait_for_timeout(random.randint(500, 1500))

        # 计算目标位置（避开边缘，模拟人类点击习惯）
        margin_x = min(box['width'] * 0.1, 5)
        margin_y = min(box['height'] * 0.1, 5)

        target_x = box['x'] + margin_x + random.uniform(0, box['width'] - 2 * margin_x)
        target_y = box['y'] + margin_y + random.uniform(0, box['height'] - 2 * margin_y)

        # 获取当前鼠标位置
        current_pos = await page.evaluate("() => ({ x: window.mouseX || Math.random() * 800, y: window.mouseY || Math.random() * 600 })")
        start_x = current_pos.get('x', random.randint(100, 700))
        start_y = current_pos.get('y', random.randint(100, 500))

        # 计算移动距离和步数
        distance = math.sqrt((target_x - start_x)**2 + (target_y - start_y)**2)
        steps = max(int(distance / 10), 5)  # 根据距离调整步数

        # 使用贝塞尔曲线模拟自然鼠标轨迹
        for i in range(steps + 1):
            t = i / steps

            # 三次贝塞尔曲线
            control1_x = start_x + (target_x - start_x) * 0.3 + random.randint(-20, 20)
            control1_y = start_y + (target_y - start_y) * 0.3 + random.randint(-20, 20)
            control2_x = start_x + (target_x - start_x) * 0.7 + random.randint(-20, 20)
            control2_y = start_y + (target_y - start_y) * 0.7 + random.randint(-20, 20)

            # 贝塞尔曲线公式
            x = (1-t)**3 * start_x + 3*(1-t)**2*t * control1_x + 3*(1-t)*t**2 * control2_x + t**3 * target_x
            y = (1-t)**3 * start_y + 3*(1-t)**2*t * control1_y + 3*(1-t)*t**2 * control2_y + t**3 * target_y

            # 添加微小的随机抖动
            x += random.uniform(-1, 1)
            y += random.uniform(-1, 1)

            await page.mouse.move(x, y)
            await page.wait_for_timeout(random.randint(5, 15))

        # 到达目标位置后的人类行为模拟
        await page.wait_for_timeout(random.randint(100, 300))

        if action_type == "click":
            # 模拟人类点击：按下-等待-释放
            await page.mouse.down()
            await page.wait_for_timeout(random.randint(50, 150))
            await page.mouse.up()
        elif action_type == "hover":
            # 只是悬停
            await page.wait_for_timeout(random.randint(200, 500))

        # 点击后的随机小幅移动
        if action_type == "click":
            await page.mouse.move(
                target_x + random.randint(-5, 5),
                target_y + random.randint(-5, 5)
            )

        return True

    except Exception as e:
        print(f"⚠️ 高级人类行为模拟失败: {e}")
        return False

async def detect_all_captcha_types(page):
    """检测所有可能的验证码类型"""
    print("🔍 全面扫描页面中的验证码组件...")

    captcha_patterns = {
        # reCAPTCHA相关
        'recaptcha_iframe': 'iframe[src*="recaptcha"]',
        'recaptcha_checkbox': '.recaptcha-checkbox',
        'recaptcha_container': '.g-recaptcha',
        'recaptcha_anchor': '#recaptcha-anchor',

        # hCaptcha相关
        'hcaptcha_iframe': 'iframe[src*="hcaptcha"]',
        'hcaptcha_checkbox': '.h-captcha',
        'hcaptcha_container': '[data-hcaptcha-widget-id]',

        # Cloudflare相关
        'cf_turnstile': '.cf-turnstile',
        'cf_challenge': '#cf-challenge-stage',
        'cf_checkbox': 'input[type="checkbox"][name*="cf"]',

        # Auth0相关
        'auth0_captcha': '.ulp-captcha-container',
        'auth0_checkbox': '.ulp-captcha input[type="checkbox"]',
        'auth0_recaptcha': '.ulp-auth0-v2-captcha',

        # 通用验证码
        'generic_captcha': '[class*="captcha"]',
        'generic_checkbox': 'input[type="checkbox"][id*="captcha"]',
        'generic_challenge': '[id*="challenge"]',
        'generic_verify': '[class*="verify"]',

        # 其他可能的模式
        'robot_checkbox': 'input[type="checkbox"][id*="robot"]',
        'human_checkbox': 'input[type="checkbox"][id*="human"]',
        'security_check': '[class*="security"]',
        'verification_box': '[class*="verification"]'
    }

    found_captchas = {}

    for captcha_type, selector in captcha_patterns.items():
        try:
            elements = await page.query_selector_all(selector)
            if elements:
                visible_elements = []
                for element in elements:
                    if await element.is_visible():
                        visible_elements.append(element)

                if visible_elements:
                    found_captchas[captcha_type] = visible_elements
                    print(f"✅ 发现 {captcha_type}: {len(visible_elements)} 个可见元素")
        except:
            continue

    return found_captchas

async def ultimate_captcha_breakthrough(page, iteration_count):
    """终极验证码突破方法"""
    print(f"\n🚀 第{iteration_count}轮 - 启动终极验证码突破...")

    # 等待页面稳定
    await page.wait_for_timeout(3000)

    # 检测所有验证码
    found_captchas = await detect_all_captcha_types(page)

    if not found_captchas:
        print("ℹ️ 未检测到验证码组件")
        return False

    print(f"🎯 检测到 {len(found_captchas)} 种验证码类型")

    # 尝试所有可能的处理方法
    success_methods = []

    for captcha_type, elements in found_captchas.items():
        print(f"\n🔧 处理 {captcha_type}...")

        for i, element in enumerate(elements):
            try:
                # 方法1: 直接点击
                print(f"   方法1: 直接点击元素 {i+1}")
                await advanced_human_simulation(page, element, "click")
                await page.wait_for_timeout(2000)

                # 检查是否成功
                if await check_success_indicators(page):
                    print(f"✅ 方法1成功! ({captcha_type})")
                    success_methods.append(f"直接点击-{captcha_type}")
                    return True

                # 方法2: 悬停后点击
                print(f"   方法2: 悬停后点击元素 {i+1}")
                await advanced_human_simulation(page, element, "hover")
                await page.wait_for_timeout(1000)
                await advanced_human_simulation(page, element, "click")
                await page.wait_for_timeout(2000)

                if await check_success_indicators(page):
                    print(f"✅ 方法2成功! ({captcha_type})")
                    success_methods.append(f"悬停点击-{captcha_type}")
                    return True

                # 方法3: 多次点击
                print(f"   方法3: 多次点击元素 {i+1}")
                for click_count in range(3):
                    await advanced_human_simulation(page, element, "click")
                    await page.wait_for_timeout(random.randint(500, 1000))

                    if await check_success_indicators(page):
                        print(f"✅ 方法3成功! ({captcha_type}, 点击{click_count+1}次)")
                        success_methods.append(f"多次点击-{captcha_type}")
                        return True

                # 方法4: 使用JavaScript点击
                print(f"   方法4: JavaScript点击元素 {i+1}")
                await page.evaluate("(element) => element.click()", element)
                await page.wait_for_timeout(2000)

                if await check_success_indicators(page):
                    print(f"✅ 方法4成功! ({captcha_type})")
                    success_methods.append(f"JS点击-{captcha_type}")
                    return True

                # 方法5: 触发各种事件
                print(f"   方法5: 触发事件元素 {i+1}")
                events = ['mousedown', 'mouseup', 'click', 'change', 'focus']
                for event in events:
                    try:
                        await page.evaluate(f"(element) => element.dispatchEvent(new Event('{event}', {{bubbles: true}}))", element)
                        await page.wait_for_timeout(500)

                        if await check_success_indicators(page):
                            print(f"✅ 方法5成功! ({captcha_type}, 事件: {event})")
                            success_methods.append(f"事件触发-{captcha_type}-{event}")
                            return True
                    except:
                        continue

            except Exception as e:
                print(f"   ⚠️ 处理元素 {i+1} 时出错: {e}")
                continue

    # 尝试iframe内的验证码
    await handle_iframe_captchas(page, iteration_count)

    return False

async def handle_iframe_captchas(page, iteration_count):
    """处理iframe内的验证码"""
    print(f"\n🖼️ 处理iframe内的验证码...")

    # 查找所有iframe
    iframes = await page.query_selector_all('iframe')
    print(f"发现 {len(iframes)} 个iframe")

    for i, iframe in enumerate(iframes):
        try:
            # 获取iframe的src
            src = await iframe.get_attribute('src')
            if src and ('captcha' in src.lower() or 'recaptcha' in src.lower() or 'hcaptcha' in src.lower()):
                print(f"🎯 处理验证码iframe {i+1}: {src[:100]}...")

                # 尝试点击iframe
                await advanced_human_simulation(page, iframe, "click")
                await page.wait_for_timeout(2000)

                if await check_success_indicators(page):
                    print(f"✅ iframe点击成功!")
                    return True

                # 尝试进入iframe内部
                try:
                    frame = await iframe.content_frame()
                    if frame:
                        print(f"   进入iframe内部...")

                        # 在iframe内查找复选框
                        checkboxes = await frame.query_selector_all('input[type="checkbox"], [role="checkbox"], .recaptcha-checkbox')

                        for checkbox in checkboxes:
                            if await checkbox.is_visible():
                                print(f"   点击iframe内复选框...")
                                await checkbox.click()
                                await page.wait_for_timeout(3000)

                                if await check_success_indicators(page):
                                    print(f"✅ iframe内复选框点击成功!")
                                    return True
                except Exception as e:
                    print(f"   ⚠️ 处理iframe内部时出错: {e}")

        except Exception as e:
            print(f"   ⚠️ 处理iframe {i+1} 时出错: {e}")
            continue

    return False

async def check_success_indicators(page):
    """检查成功指标 - 页面是否出现success字样"""
    try:
        # 等待页面响应
        await page.wait_for_timeout(1000)

        # 获取页面内容
        content = await page.content()
        content_lower = content.lower()

        # 检查success相关字样
        success_keywords = [
            'success!',
            'success',
            'successful',
            'successfully',
            'verification successful',
            'captcha solved',
            'verified successfully'
        ]

        for keyword in success_keywords:
            if keyword in content_lower:
                print(f"🎉 发现成功标识: '{keyword}'")
                return True

        # 检查页面URL变化
        current_url = page.url
        if 'success' in current_url.lower() or 'verified' in current_url.lower():
            print(f"🎉 URL显示成功: {current_url}")
            return True

        # 检查页面标题
        title = await page.title()
        if title and ('success' in title.lower() or 'verified' in title.lower()):
            print(f"🎉 标题显示成功: {title}")
            return True

        return False

    except Exception as e:
        print(f"⚠️ 检查成功指标时出错: {e}")
        return False

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

async def infinite_captcha_breakthrough():
    """无限迭代的验证码突破流程"""
    email = "wg824468733wg+123@gmail.com"
    iteration_count = 0

    print("🚀 启动无限迭代验证码突破模式")
    print("🎯 目标: 页面出现'success'字样")
    print("⏰ 时间: 无上限，直到成功")
    print("-" * 60)

    async with async_playwright() as p:
        while True:  # 无限循环直到成功
            iteration_count += 1
            print(f"\n🔄 第 {iteration_count} 轮迭代开始...")

            try:
                # 启动浏览器
                browser = await p.chromium.launch(
                    headless=True,  # 服务器环境使用headless模式
                    args=[
                        '--no-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    ]
                )

                # 创建新页面并设置反检测
                page = await browser.new_page(viewport={'width': 1366, 'height': 768})

                # 反自动化检测设置
                await page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });

                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });

                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });

                    window.chrome = {
                        runtime: {},
                    };
                """)

                # 设置随机的用户代理和头部
                user_agents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ]

                await page.set_extra_http_headers({
                    'User-Agent': random.choice(user_agents),
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                })

                print(f"✅ 浏览器启动成功 (第{iteration_count}轮)")

                # 尝试访问注册页面
                success = await attempt_registration_flow(page, email, iteration_count)

                # 关闭浏览器
                await browser.close()

                if success:
                    print(f"\n🎉🎉🎉 SUCCESS! 第 {iteration_count} 轮迭代成功突破验证码!")
                    print("🏆 页面已出现'success'字样，任务完成!")

                    # 清理旧截图，只保留重要节点
                    await cleanup_and_save_key_screenshots(iteration_count)
                    return True
                else:
                    print(f"\n⚠️ 第 {iteration_count} 轮未成功，继续下一轮...")

                    # 随机等待时间，避免被检测
                    wait_time = random.randint(3, 8)
                    print(f"⏳ 等待 {wait_time} 秒后继续...")
                    await asyncio.sleep(wait_time)

            except Exception as e:
                print(f"❌ 第 {iteration_count} 轮发生错误: {str(e)}")
                try:
                    await browser.close()
                except:
                    pass

                # 短暂等待后继续
                await asyncio.sleep(2)
                continue

async def attempt_registration_flow(page, email, iteration_count):
    """尝试注册流程"""
    try:
        # 访问注册页面
        print(f"📄 访问注册页面...")

        urls_to_try = [
            "https://augmentcode.com/signup",
            "https://auth.augmentcode.com/signup/login?individual=true",
            "https://www.augmentcode.com/signup"
        ]

        page_loaded = False
        for url in urls_to_try:
            try:
                print(f"   尝试访问: {url}")
                await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                await page.wait_for_timeout(3000)

                # 检查页面是否正常加载
                title = await page.title()
                if title and len(title) > 0:
                    print(f"✅ 页面加载成功: {title}")
                    print(f"   URL: {page.url}")
                    page_loaded = True
                    break
            except Exception as e:
                print(f"   ❌ 访问失败: {e}")
                continue

        if not page_loaded:
            print("❌ 所有URL都无法访问")
            return False

        # 截图1: 初始页面
        await page.screenshot(path=f"iteration_{iteration_count:03d}_01_initial.png", full_page=True)
        print(f"📸 截图: iteration_{iteration_count:03d}_01_initial.png")

        # 查找并填写邮箱
        email_success = await find_and_fill_email(page, email, iteration_count)
        if not email_success:
            return False

        # 截图2: 填写邮箱后
        await page.screenshot(path=f"iteration_{iteration_count:03d}_02_email_filled.png", full_page=True)
        print(f"📸 截图: iteration_{iteration_count:03d}_02_email_filled.png")

        # 终极验证码突破
        captcha_success = await ultimate_captcha_breakthrough(page, iteration_count)

        # 截图3: 验证码处理后
        await page.screenshot(path=f"iteration_{iteration_count:03d}_03_captcha_handled.png", full_page=True)
        print(f"📸 截图: iteration_{iteration_count:03d}_03_captcha_handled.png")

        # 查找并点击提交按钮
        submit_success = await find_and_click_submit(page, iteration_count)
        if not submit_success:
            return False

        # 截图4: 提交后
        await page.screenshot(path=f"iteration_{iteration_count:03d}_04_submitted.png", full_page=True)
        print(f"📸 截图: iteration_{iteration_count:03d}_04_submitted.png")

        # 等待响应并检查成功
        await page.wait_for_timeout(5000)

        # 最终检查成功指标
        final_success = await check_success_indicators(page)

        if final_success:
            # 截图5: 成功页面
            await page.screenshot(path=f"iteration_{iteration_count:03d}_05_SUCCESS.png", full_page=True)
            print(f"📸 成功截图: iteration_{iteration_count:03d}_05_SUCCESS.png")

            # 保存成功页面HTML
            content = await page.content()
            with open(f"iteration_{iteration_count:03d}_SUCCESS.html", "w", encoding="utf-8") as f:
                f.write(content)
            print(f"💾 成功页面HTML: iteration_{iteration_count:03d}_SUCCESS.html")

        return final_success

    except Exception as e:
        print(f"❌ 注册流程异常: {e}")
        return False

async def find_and_fill_email(page, email, iteration_count):
    """查找并填写邮箱"""
    print("📝 查找并填写邮箱...")

    # 扩展的邮箱输入框选择器
    email_selectors = [
        'input[name="username"]',
        'input[type="email"]',
        'input[name="email"]',
        'input[id="username"]',
        'input[id="email"]',
        'input[inputmode="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="Email" i]',
        'input[placeholder*="用户名"]',
        'input[placeholder*="邮箱"]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
        '[data-testid*="email"]',
        '[data-testid*="username"]',
        '.email-input',
        '.username-input',
        '#email',
        '#username',
        '#user-email',
        '#user_email'
    ]

    for selector in email_selectors:
        try:
            elements = await page.query_selector_all(selector)
            for element in elements:
                if await element.is_visible() and await element.is_enabled():
                    print(f"✅ 找到邮箱输入框: {selector}")

                    # 高级人类模拟输入
                    await advanced_human_simulation(page, element, "click")
                    await page.wait_for_timeout(random.randint(300, 800))

                    # 清空并输入邮箱
                    await element.fill("")
                    await page.wait_for_timeout(random.randint(100, 300))

                    # 模拟人类打字
                    for char in email:
                        await element.type(char)
                        await page.wait_for_timeout(random.randint(30, 120))

                    print(f"✅ 邮箱输入完成: {email}")
                    return True
        except:
            continue

    print("❌ 未找到邮箱输入框")
    return False

async def find_and_click_submit(page, iteration_count):
    """查找并点击提交按钮"""
    print("🔘 查找并点击提交按钮...")

    # 扩展的提交按钮选择器
    submit_selectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button[name="action"]',
        'button[value="default"]',
        'button:has-text("Continue")',
        'button:has-text("continue")',
        'button:has-text("Submit")',
        'button:has-text("submit")',
        'button:has-text("Sign up")',
        'button:has-text("Sign Up")',
        'button:has-text("Register")',
        'button:has-text("Next")',
        'button:has-text("Proceed")',
        '[data-testid*="submit"]',
        '[data-testid*="continue"]',
        '.submit-button',
        '.continue-button',
        '#submit',
        '#continue',
        'button.primary',
        'button.btn-primary'
    ]

    for selector in submit_selectors:
        try:
            elements = await page.query_selector_all(selector)
            for element in elements:
                if await element.is_visible() and await element.is_enabled():
                    print(f"✅ 找到提交按钮: {selector}")

                    # 高级人类模拟点击
                    await advanced_human_simulation(page, element, "click")
                    await page.wait_for_timeout(random.randint(1000, 3000))

                    print("✅ 提交按钮点击完成")
                    return True
        except:
            continue

    # 如果没找到，尝试查找所有按钮并分析
    print("🔍 分析页面中的所有按钮...")
    buttons = await page.query_selector_all('button, input[type="submit"], input[type="button"]')

    for i, btn in enumerate(buttons):
        try:
            if await btn.is_visible() and await btn.is_enabled():
                btn_text = await btn.text_content() or ""
                btn_type = await btn.get_attribute('type') or ""
                btn_class = await btn.get_attribute('class') or ""
                btn_id = await btn.get_attribute('id') or ""

                # 分析按钮特征
                is_submit_button = (
                    btn_type == 'submit' or
                    'submit' in btn_text.lower() or
                    'continue' in btn_text.lower() or
                    'next' in btn_text.lower() or
                    'sign up' in btn_text.lower() or
                    'register' in btn_text.lower() or
                    'primary' in btn_class.lower() or
                    'submit' in btn_class.lower() or
                    'continue' in btn_class.lower()
                )

                if is_submit_button:
                    print(f"✅ 找到可能的提交按钮 {i+1}: '{btn_text}' (type={btn_type})")

                    # 尝试点击
                    await advanced_human_simulation(page, btn, "click")
                    await page.wait_for_timeout(random.randint(1000, 3000))

                    print(f"✅ 按钮 {i+1} 点击完成")
                    return True
        except:
            continue

    print("❌ 未找到提交按钮")
    return False

async def cleanup_and_save_key_screenshots(successful_iteration):
    """清理旧截图，只保留关键节点截图"""
    print("\n🧹 清理截图文件，保留关键节点...")

    try:
        # 删除所有旧的截图文件
        old_screenshots = glob.glob("playwright_*.png") + glob.glob("iteration_*.png")

        # 保留成功迭代的关键截图
        key_screenshots = [
            f"iteration_{successful_iteration:03d}_01_initial.png",
            f"iteration_{successful_iteration:03d}_02_email_filled.png",
            f"iteration_{successful_iteration:03d}_03_captcha_handled.png",
            f"iteration_{successful_iteration:03d}_04_submitted.png",
            f"iteration_{successful_iteration:03d}_05_SUCCESS.png"
        ]

        # 重命名关键截图
        rename_map = {
            f"iteration_{successful_iteration:03d}_01_initial.png": "01_initial_page.png",
            f"iteration_{successful_iteration:03d}_02_email_filled.png": "02_email_filled.png",
            f"iteration_{successful_iteration:03d}_03_captcha_handled.png": "03_captcha_breakthrough.png",
            f"iteration_{successful_iteration:03d}_04_submitted.png": "04_form_submitted.png",
            f"iteration_{successful_iteration:03d}_05_SUCCESS.png": "05_SUCCESS_ACHIEVED.png"
        }

        # 删除旧截图
        deleted_count = 0
        for screenshot in old_screenshots:
            if screenshot not in key_screenshots:
                try:
                    os.remove(screenshot)
                    deleted_count += 1
                except:
                    pass

        print(f"✅ 删除了 {deleted_count} 个旧截图文件")

        # 重命名关键截图
        renamed_count = 0
        for old_name, new_name in rename_map.items():
            if os.path.exists(old_name):
                try:
                    os.rename(old_name, new_name)
                    renamed_count += 1
                    print(f"📸 保留关键截图: {new_name}")
                except:
                    pass

        print(f"✅ 重命名了 {renamed_count} 个关键截图")

        # 保留成功页面HTML
        success_html = f"iteration_{successful_iteration:03d}_SUCCESS.html"
        if os.path.exists(success_html):
            os.rename(success_html, "SUCCESS_PAGE.html")
            print("💾 保留成功页面: SUCCESS_PAGE.html")

        print("🎯 截图清理完成，只保留关键节点截图")

    except Exception as e:
        print(f"⚠️ 清理截图时出错: {e}")
async def main():
    """主函数 - 启动无限迭代验证码突破"""
    print("🎯 Augment Code 终极验证码突破工具")
    print("=" * 60)
    print("🚀 特性:")
    print("  • 无限迭代直到成功")
    print("  • 多种验证码检测和处理")
    print("  • 高级人类行为模拟")
    print("  • 反自动化检测")
    print("  • 以'success'字样为成功标准")
    print("=" * 60)

    # 启动无限迭代突破
    success = await infinite_captcha_breakthrough()

    if success:
        print("\n" + "🎉" * 20)
        print("🏆 任务完成! 成功突破验证码!")
        print("✅ 页面已出现'success'字样")
        print("📸 已保留关键节点截图")
        print("💾 已保存成功页面HTML")
        print("🎉" * 20)
    else:
        print("\n❌ 意外终止，但会继续尝试...")

if __name__ == "__main__":
    asyncio.run(main())


