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

async def detect_iframe_captchas(page):
    """专门检测iframe内的验证码复选框"""
    iframe_captchas = []

    print("🔍 检测验证码iframe...")
    iframes = await page.query_selector_all('iframe')

    for i, iframe in enumerate(iframes):
        try:
            src = await iframe.get_attribute('src') or ''
            title = await iframe.get_attribute('title') or ''

            # 检查是否是验证码iframe
            if any(keyword in (src + title).lower() for keyword in ['recaptcha', 'hcaptcha', 'turnstile', 'captcha']):
                print(f"✅ 发现验证码iframe {i+1}: {src[:80]}...")

                # 尝试访问iframe内容
                try:
                    frame = await iframe.content_frame()
                    if frame:
                        # 在iframe内查找复选框
                        checkboxes = await frame.query_selector_all('input[type="checkbox"], .recaptcha-checkbox, .recaptcha-checkbox-border, #recaptcha-anchor')
                        for checkbox in checkboxes:
                            if await checkbox.is_visible():
                                iframe_captchas.append({
                                    'element': checkbox,
                                    'frame': frame,
                                    'iframe_src': src,
                                    'type': 'iframe_checkbox'
                                })
                                print(f"   ✅ 找到iframe内复选框")
                except Exception as e:
                    print(f"   ⚠️ 无法访问iframe内容: {e}")
                    # 如果无法访问iframe内容，就点击iframe本身
                    iframe_captchas.append({
                        'element': iframe,
                        'frame': None,
                        'iframe_src': src,
                        'type': 'iframe_container'
                    })

        except Exception as e:
            print(f"⚠️ 检测iframe {i+1} 时出错: {e}")
            continue

    return iframe_captchas

async def find_clickable_elements_in_container(page, container_element):
    """在验证码容器内寻找真正可点击的元素"""
    clickable_elements = []

    try:
        # 在容器内查找各种可能的可点击元素
        selectors = [
            # 最优先的真正可点击元素
            'input[type="checkbox"]',
            'button',
            '[role="checkbox"]',
            '[role="button"]',

            # reCAPTCHA特定元素
            '.recaptcha-checkbox',
            '.recaptcha-checkbox-border',
            '.recaptcha-checkbox-checkmark',
            '#recaptcha-anchor',
            '.recaptcha-anchor',

            # hCaptcha特定元素
            '.hcaptcha-checkbox',
            '.h-captcha-checkbox',
            '.h-captcha input',
            '.h-captcha button',

            # Cloudflare Turnstile特定元素
            '.cf-turnstile input',
            '.cf-turnstile button',
            '.cf-turnstile [role="checkbox"]',

            # 通用可交互元素
            'div[tabindex="0"]',
            'span[role="checkbox"]',
            'div[role="button"]',
            'a[role="button"]',

            # 可能的点击目标
            '[onclick]',
            '[data-callback]',
            '[data-sitekey]',
            '.clickable',
            '.interactive'
        ]

        for selector in selectors:
            elements = await container_element.query_selector_all(selector)
            for element in elements:
                if await element.is_visible():
                    clickable_elements.append({
                        'element': element,
                        'selector': selector,
                        'type': 'inner_clickable'
                    })
                    print(f"   ✅ 在容器内找到可点击元素: {selector}")

        # 如果没找到内部元素，就返回容器本身
        if not clickable_elements:
            clickable_elements.append({
                'element': container_element,
                'selector': 'container',
                'type': 'container_fallback'
            })
            print(f"   ⚠️ 未找到内部可点击元素，将点击容器本身")

    except Exception as e:
        print(f"   ⚠️ 搜索容器内元素时出错: {e}")
        clickable_elements.append({
            'element': container_element,
            'selector': 'container',
            'type': 'container_fallback'
        })

    return clickable_elements

async def detect_all_captcha_types(page):
    """检测所有可能的验证码类型"""
    print("🔍 全面扫描页面中的验证码组件...")

    # 等待验证码加载 - 增加等待时间
    print("⏳ 等待验证码组件加载...")
    await page.wait_for_timeout(10000)  # 增加到10秒

    # 尝试填写邮箱以触发验证码
    print("📧 尝试填写邮箱以触发验证码...")
    try:
        email_selectors = [
            'input[name="username"]',
            'input[name="email"]',
            'input[type="email"]',
            'input[placeholder*="email" i]',
            'input[placeholder*="邮箱" i]',
            '#email',
            '#username',
            '.email-input',
            '.username-input'
        ]

        for selector in email_selectors:
            try:
                email_input = await page.query_selector(selector)
                if email_input and await email_input.is_visible():
                    print(f"   ✅ 找到邮箱输入框: {selector}")
                    await email_input.click()
                    await page.wait_for_timeout(1000)
                    await email_input.fill('wg824468733wg+123@gmail.com')
                    await page.wait_for_timeout(2000)

                    # 尝试按Tab键或点击其他地方触发验证码
                    await page.keyboard.press('Tab')
                    await page.wait_for_timeout(3000)
                    break
            except:
                continue
    except Exception as e:
        print(f"   ⚠️ 填写邮箱失败: {e}")

    # 尝试滚动页面以触发验证码加载
    print("📜 滚动页面以触发验证码加载...")
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    await page.wait_for_timeout(3000)
    await page.evaluate("window.scrollTo(0, 0)")
    await page.wait_for_timeout(3000)

    # 尝试点击页面各个位置以触发验证码
    print("👆 点击页面各个位置以触发验证码显示...")
    try:
        click_positions = [
            {'x': 400, 'y': 300},
            {'x': 500, 'y': 400},
            {'x': 600, 'y': 500},
            {'x': 300, 'y': 600}
        ]

        for pos in click_positions:
            await page.mouse.click(pos['x'], pos['y'])
            await page.wait_for_timeout(2000)
    except:
        pass

    # 尝试模拟用户行为
    print("🤖 模拟真实用户行为...")
    try:
        # 移动鼠标
        await page.mouse.move(100, 100)
        await page.wait_for_timeout(1000)
        await page.mouse.move(500, 300)
        await page.wait_for_timeout(1000)

        # 按一些键
        await page.keyboard.press('Tab')
        await page.wait_for_timeout(1000)
        await page.keyboard.press('Enter')
        await page.wait_for_timeout(3000)
    except:
        pass

    # 动态等待验证码元素出现
    print("🔄 动态等待验证码元素出现...")
    captcha_selectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        'iframe[src*="turnstile"]',
        '.recaptcha-checkbox',
        '.h-captcha',
        '.cf-turnstile',
        'input[type="checkbox"][id*="captcha"]',
        '[role="checkbox"]'
    ]

    for attempt in range(10):  # 尝试10次，每次等待2秒
        found_any = False
        for selector in captcha_selectors:
            try:
                elements = await page.query_selector_all(selector)
                if elements:
                    for element in elements:
                        if await element.is_visible():
                            print(f"✅ 第{attempt+1}次尝试发现验证码元素: {selector}")
                            found_any = True
                            break
                if found_any:
                    break
            except:
                continue

        if found_any:
            print(f"🎯 验证码元素已出现，等待完全加载...")
            await page.wait_for_timeout(3000)
            break
        else:
            print(f"⏳ 第{attempt+1}次未发现验证码，继续等待...")
            await page.wait_for_timeout(2000)

    # 首先检测iframe内的验证码
    iframe_captchas = await detect_iframe_captchas(page)

    captcha_patterns = {
        # 优先级1: 真正的复选框和按钮
        'recaptcha_checkbox_real': '.recaptcha-checkbox-checkmark, .recaptcha-checkbox-border',
        'recaptcha_anchor_real': '#recaptcha-anchor',
        'hcaptcha_checkbox_real': '.hcaptcha-checkbox, .h-captcha-checkbox',
        'cf_turnstile_checkbox_real': '.cf-turnstile input[type="checkbox"], .cf-turnstile button',

        # 优先级2: Auth0特定元素
        'auth0_captcha_checkbox': '.ulp-captcha input[type="checkbox"]',
        'auth0_captcha_button': '.ulp-captcha button',
        'auth0_recaptcha_checkbox': '.ulp-auth0-v2-captcha .recaptcha-checkbox',
        'auth0_turnstile_checkbox': '#ulp-auth0-v2-captcha input, #ulp-auth0-v2-captcha button',

        # 优先级3: 通用复选框
        'checkbox_captcha': 'input[type="checkbox"][id*="captcha"], input[type="checkbox"][name*="captcha"]',
        'checkbox_robot': 'input[type="checkbox"][id*="robot"], input[type="checkbox"][name*="robot"]',
        'checkbox_human': 'input[type="checkbox"][id*="human"], input[type="checkbox"][name*="human"]',
        'checkbox_verify': 'input[type="checkbox"][id*="verify"], input[type="checkbox"][name*="verify"]',
        'checkbox_security': 'input[type="checkbox"][id*="security"], input[type="checkbox"][name*="security"]',

        # 优先级4: 按钮类型
        'button_captcha': 'button[id*="captcha"], button[class*="captcha"]',
        'button_verify': 'button[id*="verify"], button[class*="verify"]',
        'button_robot': 'button[id*="robot"], button[class*="robot"]',
        'button_human': 'button[id*="human"], button[class*="human"]',

        # 优先级5: iframe内容
        'recaptcha_iframe': 'iframe[src*="recaptcha"]',
        'hcaptcha_iframe': 'iframe[src*="hcaptcha"]',
        'turnstile_iframe': 'iframe[src*="turnstile"]',
        'captcha_iframe': 'iframe[src*="captcha"]',

        # 优先级6: 容器（作为最后的备选）
        'auth0_captcha_container': '.ulp-captcha-container',
        'auth0_recaptcha_container': '.ulp-auth0-v2-captcha',
        'auth0_turnstile_container': '#ulp-auth0-v2-captcha',
        'recaptcha_container': '.g-recaptcha',
        'hcaptcha_container': '.h-captcha',
        'cf_turnstile_container': '.cf-turnstile',
        'generic_captcha_container': '[class*="captcha"]',
        'generic_verify_container': '[class*="verify"]',
        'generic_challenge_container': '[id*="challenge"]',
        'security_check_container': '[class*="security"]'
    }

    found_captchas = {}

    for captcha_type, selector in captcha_patterns.items():
        try:
            elements = await page.query_selector_all(selector)
            if elements:
                visible_elements = []
                for element in elements:
                    if await element.is_visible():
                        # 获取元素的详细信息用于调试
                        element_info = await page.evaluate("""
                            (el) => ({
                                tagName: el.tagName,
                                id: el.id,
                                className: el.className,
                                type: el.type,
                                innerHTML: el.innerHTML.substring(0, 100),
                                outerHTML: el.outerHTML.substring(0, 200)
                            })
                        """, element)

                        visible_elements.append({
                            'element': element,
                            'info': element_info
                        })

                if visible_elements:
                    found_captchas[captcha_type] = visible_elements
                    print(f"✅ 发现 {captcha_type}: {len(visible_elements)} 个可见元素")
                    for i, elem_data in enumerate(visible_elements):
                        info = elem_data['info']
                        print(f"   元素{i+1}: <{info['tagName']} id='{info['id']}' class='{info['className'][:50]}' type='{info['type']}'>")
        except Exception as e:
            print(f"⚠️ 检测 {captcha_type} 时出错: {e}")
            continue

    # 添加iframe验证码到结果中
    if iframe_captchas:
        found_captchas['iframe_captchas'] = iframe_captchas
        print(f"✅ 发现 iframe_captchas: {len(iframe_captchas)} 个iframe验证码")
        for i, iframe_data in enumerate(iframe_captchas):
            print(f"   iframe{i+1}: {iframe_data['type']} - {iframe_data['iframe_src'][:50]}...")

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

    # 优先处理iframe验证码
    if 'iframe_captchas' in found_captchas:
        print(f"\n🔧 优先处理 iframe_captchas...")
        for i, iframe_data in enumerate(found_captchas['iframe_captchas']):
            element = iframe_data['element']
            iframe_type = iframe_data['type']
            iframe_src = iframe_data['iframe_src']

            print(f"   🎯 处理iframe元素{i+1}: {iframe_type} - {iframe_src[:50]}...")

            try:
                # 方法1: 直接点击iframe内的复选框或iframe本身
                print(f"   方法1: 直接点击iframe元素 {i+1}")
                if iframe_data['frame']:
                    # 如果能访问iframe内容，在iframe内点击
                    await iframe_data['frame'].click(element)
                else:
                    # 否则点击iframe容器
                    await advanced_human_simulation(page, element, "click")
                await page.wait_for_timeout(3000)

                # 检查是否成功
                if await check_success_indicators(page):
                    print(f"✅ iframe方法1成功! ({iframe_type})")
                    success_methods.append(f"iframe直接点击-{iframe_type}")
                    return True

            except Exception as e:
                print(f"   ⚠️ iframe方法1失败: {e}")
                continue

    # 然后处理其他类型的验证码
    for captcha_type, element_data_list in found_captchas.items():
        if captcha_type == 'iframe_captchas':
            continue  # 已经处理过了

        print(f"\n🔧 处理 {captcha_type}...")

        for i, element_data in enumerate(element_data_list):
            element = element_data['element']
            info = element_data['info']

            print(f"   🎯 处理元素{i+1}: <{info['tagName']} id='{info['id']}' class='{info['className'][:30]}'>")

            # 首先在容器内寻找真正的可点击元素
            print(f"   🔍 在容器内寻找可点击元素...")
            clickable_elements = await find_clickable_elements_in_container(page, element)

            # 尝试点击找到的每个可点击元素
            for j, clickable_data in enumerate(clickable_elements):
                clickable_element = clickable_data['element']
                selector = clickable_data['selector']
                click_type = clickable_data['type']

                print(f"   🎯 尝试点击 {click_type}: {selector}")

                try:
                    # 方法1: 直接点击可点击元素
                    print(f"   方法1: 直接点击 {selector} 元素")
                    await advanced_human_simulation(page, clickable_element, "click")
                    print(f"   ⏳ 等待验证码处理...")
                    await page.wait_for_timeout(8000)  # 增加到8秒等待验证码处理

                    # 检查是否成功
                    if await check_success_indicators(page):
                        print(f"✅ 方法1成功! ({captcha_type} - {selector})")
                        print(f"   成功元素: {click_type} - {selector}")
                        success_methods.append(f"直接点击-{captcha_type}-{selector}")
                        return True

                except Exception as e:
                    print(f"   ⚠️ 点击 {selector} 失败: {e}")
                    continue

            try:
                # 方法2: 悬停后点击
                print(f"   方法2: 悬停后点击元素 {i+1}")
                await advanced_human_simulation(page, element, "hover")
                await page.wait_for_timeout(2000)
                await advanced_human_simulation(page, element, "click")
                print(f"   ⏳ 等待验证码处理...")
                await page.wait_for_timeout(8000)

                if await check_success_indicators(page):
                    print(f"✅ 方法2成功! ({captcha_type})")
                    success_methods.append(f"悬停点击-{captcha_type}")
                    return True

                # 方法3: 多次点击
                print(f"   方法3: 多次点击元素 {i+1}")
                for click_count in range(5):  # 增加点击次数
                    await advanced_human_simulation(page, element, "click")
                    await page.wait_for_timeout(random.randint(1000, 2000))  # 增加等待时间

                    if await check_success_indicators(page):
                        print(f"✅ 方法3成功! ({captcha_type}, 点击{click_count+1}次)")
                        success_methods.append(f"多次点击-{captcha_type}")
                        return True

                # 最后等待更长时间检查
                print(f"   ⏳ 多次点击后等待验证码处理...")
                await page.wait_for_timeout(8000)

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
                events = ['mousedown', 'mouseup', 'click', 'change', 'focus', 'blur', 'keydown', 'keyup']
                for event in events:
                    try:
                        await page.evaluate(f"(element) => element.dispatchEvent(new Event('{event}', {{bubbles: true}}))", element)
                        await page.wait_for_timeout(1000)

                        if await check_success_indicators(page):
                            print(f"✅ 方法5成功! ({captcha_type}, 事件: {event})")
                            success_methods.append(f"事件触发-{captcha_type}-{event}")
                            return True
                    except:
                        continue

                # 方法6: 强制点击（忽略可见性）
                print(f"   方法6: 强制点击元素 {i+1}")
                try:
                    await page.evaluate("(element) => element.click()", element)
                    await page.wait_for_timeout(3000)

                    if await check_success_indicators(page):
                        print(f"✅ 方法6成功! ({captcha_type})")
                        success_methods.append(f"强制点击-{captcha_type}")
                        return True
                except:
                    pass

                # 方法7: 模拟键盘操作
                print(f"   方法7: 键盘操作元素 {i+1}")
                try:
                    await element.focus()
                    await page.wait_for_timeout(1000)
                    await page.keyboard.press('Space')
                    await page.wait_for_timeout(2000)

                    if await check_success_indicators(page):
                        print(f"✅ 方法7成功! ({captcha_type})")
                        success_methods.append(f"键盘操作-{captcha_type}")
                        return True

                    await page.keyboard.press('Enter')
                    await page.wait_for_timeout(2000)

                    if await check_success_indicators(page):
                        print(f"✅ 方法7成功! ({captcha_type})")
                        success_methods.append(f"键盘操作-{captcha_type}")
                        return True
                except:
                    pass

                # 方法8: 双击
                print(f"   方法8: 双击元素 {i+1}")
                try:
                    await element.dblclick()
                    await page.wait_for_timeout(3000)

                    if await check_success_indicators(page):
                        print(f"✅ 方法8成功! ({captcha_type})")
                        success_methods.append(f"双击-{captcha_type}")
                        return True
                except:
                    pass

                # 方法9: 右键点击
                print(f"   方法9: 右键点击元素 {i+1}")
                try:
                    await element.click(button='right')
                    await page.wait_for_timeout(2000)
                    await page.keyboard.press('Escape')  # 关闭右键菜单
                    await page.wait_for_timeout(1000)

                    if await check_success_indicators(page):
                        print(f"✅ 方法9成功! ({captcha_type})")
                        success_methods.append(f"右键点击-{captcha_type}")
                        return True
                except:
                    pass

                # 方法10: 拖拽操作
                print(f"   方法10: 拖拽元素 {i+1}")
                try:
                    box = await element.bounding_box()
                    if box:
                        start_x = box['x'] + box['width'] / 2
                        start_y = box['y'] + box['height'] / 2
                        end_x = start_x + 10
                        end_y = start_y + 10

                        await page.mouse.move(start_x, start_y)
                        await page.mouse.down()
                        await page.wait_for_timeout(500)
                        await page.mouse.move(end_x, end_y)
                        await page.wait_for_timeout(500)
                        await page.mouse.up()
                        await page.wait_for_timeout(2000)

                        if await check_success_indicators(page):
                            print(f"✅ 方法10成功! ({captcha_type})")
                            success_methods.append(f"拖拽操作-{captcha_type}")
                            return True
                except:
                    pass

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
    """检查成功指标 - 页面是否出现success字样或到达验证码页面"""
    try:
        # 等待页面响应
        await page.wait_for_timeout(2000)

        # 获取页面内容和可见文本
        content = await page.content()
        content_lower = content.lower()

        # 获取页面的可见文本内容（排除CSS和JavaScript）
        visible_text = await page.evaluate("""
            () => {
                // 移除script和style标签
                const scripts = document.querySelectorAll('script, style');
                scripts.forEach(el => el.remove());

                // 获取body的文本内容
                return document.body ? document.body.innerText.toLowerCase() : '';
            }
        """)

        print(f"🔍 页面可见文本内容预览: {visible_text[:200]}...")

        # 严格检查"Success!"字样（区分大小写）
        if 'Success!' in await page.evaluate("() => document.body ? document.body.innerText : ''"):
            print(f"🎉 发现严格的成功标识: 'Success!'")
            return True

        # 检查其他可能的成功标识（在可见文本中）
        success_keywords = [
            'successful',
            'successfully',
            'verification successful',
            'captcha solved',
            'verified successfully',
            'registration successful',
            'account created successfully'
        ]

        for keyword in success_keywords:
            if keyword in visible_text:
                print(f"🎉 在可见文本中发现成功标识: '{keyword}'")
                return True

        # 检查是否到达验证码输入页面
        verification_indicators = [
            'enter the code',
            'verification code',
            'check your email',
            'we sent you',
            'enter code',
            '6-digit code',
            'verify your email',
            'email verification'
        ]

        for indicator in verification_indicators:
            if indicator in visible_text:
                print(f"🎉 检测到验证码页面标识: '{indicator}'")
                return True

        # 检查页面URL变化
        current_url = page.url
        if any(keyword in current_url.lower() for keyword in ['success', 'verified', 'verification', 'confirm']):
            print(f"🎉 URL显示成功或验证: {current_url}")
            return True

        # 检查页面标题
        title = await page.title()
        if title:
            title_lower = title.lower()
            if any(keyword in title_lower for keyword in ['success', 'verified', 'verification', 'confirm']):
                print(f"🎉 标题显示成功或验证: {title}")
                return True

        # 检查是否有验证码输入框
        code_inputs = await page.query_selector_all('input[type="text"][maxlength="6"], input[type="number"][maxlength="6"], input[placeholder*="code" i], input[name*="code" i]')
        if code_inputs:
            print(f"🎉 发现验证码输入框: {len(code_inputs)} 个")
            return True

        print("❌ 未发现成功标识或验证码页面")
        print(f"   当前URL: {current_url}")
        print(f"   页面标题: {title}")

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


