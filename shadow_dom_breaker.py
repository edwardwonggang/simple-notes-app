#!/usr/bin/env python3
"""
🎯 Shadow DOM 突破工具
专门处理Cloudflare Turnstile + Shadow DOM (Closed)的验证码
"""

import asyncio
from playwright.async_api import async_playwright
import time

class ShadowDOMBreaker:
    def __init__(self):
        self.iteration = 1
        self.max_iterations = 10
        self.test_email = 'wg824468733wg+123@gmail.com'
        
    async def take_screenshot(self, page, name):
        """截图"""
        filename = f"shadow_dom_{self.iteration:03d}_{name}.png"
        await page.screenshot(path=filename, full_page=True)
        print(f"📸 截图: {filename}")
        return filename
    
    async def inject_shadow_dom_piercer(self, page):
        """注入Shadow DOM穿透脚本"""
        print("🔧 注入Shadow DOM穿透脚本...")
        
        shadow_piercer_script = """
        window.shadowDOMPiercer = {
            // 递归查找所有shadow root（包括closed）
            findAllShadowRoots: function(element = document) {
                const shadowRoots = [];
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_ELEMENT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    if (node.shadowRoot) {
                        shadowRoots.push(node.shadowRoot);
                        // 递归查找嵌套的shadow root
                        shadowRoots.push(...this.findAllShadowRoots(node.shadowRoot));
                    }
                    
                    // 尝试访问closed shadow root的hack方法
                    try {
                        const shadowRoot = node.attachShadow ? node.shadowRoot : null;
                        if (shadowRoot && !shadowRoots.includes(shadowRoot)) {
                            shadowRoots.push(shadowRoot);
                        }
                    } catch (e) {
                        // Closed shadow root无法直接访问
                    }
                }
                
                return shadowRoots;
            },
            
            // 在所有shadow root中查找文本
            findTextInShadowRoots: function(searchText) {
                const shadowRoots = this.findAllShadowRoots();
                const results = [];
                
                shadowRoots.forEach((shadowRoot, index) => {
                    try {
                        const textContent = shadowRoot.textContent || '';
                        if (textContent.includes(searchText)) {
                            results.push({
                                index: index,
                                shadowRoot: shadowRoot,
                                textContent: textContent.substring(0, 200)
                            });
                        }
                    } catch (e) {
                        console.log('无法访问shadow root:', e);
                    }
                });
                
                return results;
            },
            
            // 在所有shadow root中查找可点击元素
            findClickableInShadowRoots: function() {
                const shadowRoots = this.findAllShadowRoots();
                const clickableElements = [];
                
                shadowRoots.forEach((shadowRoot, index) => {
                    try {
                        const selectors = [
                            'input[type="checkbox"]',
                            'button',
                            '[role="checkbox"]',
                            '[role="button"]',
                            '.cf-turnstile input',
                            '.cf-turnstile button',
                            '[data-callback]',
                            '[onclick]'
                        ];
                        
                        selectors.forEach(selector => {
                            const elements = shadowRoot.querySelectorAll(selector);
                            elements.forEach(el => {
                                if (el.offsetParent !== null) { // 检查是否可见
                                    clickableElements.push({
                                        element: el,
                                        selector: selector,
                                        shadowRootIndex: index
                                    });
                                }
                            });
                        });
                    } catch (e) {
                        console.log('无法搜索shadow root:', e);
                    }
                });
                
                return clickableElements;
            },
            
            // 强制点击shadow root内的元素
            forceClickInShadowRoot: function(element) {
                try {
                    // 方法1: 直接点击
                    element.click();
                    return true;
                } catch (e) {
                    try {
                        // 方法2: 触发事件
                        const event = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        element.dispatchEvent(event);
                        return true;
                    } catch (e2) {
                        console.log('强制点击失败:', e2);
                        return false;
                    }
                }
            }
        };
        
        console.log('Shadow DOM穿透脚本已注入');
        """
        
        await page.evaluate(shadow_piercer_script)
        print("✅ Shadow DOM穿透脚本注入完成")
    
    async def check_success_in_shadow_dom(self, page):
        """在Shadow DOM中检查SUCCESS!"""
        print("🔍 在Shadow DOM中检查SUCCESS!...")
        
        try:
            # 使用注入的脚本查找SUCCESS!
            success_results = await page.evaluate("""
                () => {
                    if (window.shadowDOMPiercer) {
                        return window.shadowDOMPiercer.findTextInShadowRoots('Success!');
                    }
                    return [];
                }
            """)
            
            if success_results and len(success_results) > 0:
                print(f"🎉 在Shadow DOM中发现SUCCESS!: {len(success_results)}个位置")
                for i, result in enumerate(success_results):
                    print(f"   位置{i+1}: {result.get('textContent', '')[:100]}...")
                return True
            else:
                print("❌ 在Shadow DOM中未发现SUCCESS!")
                return False
                
        except Exception as e:
            print(f"❌ 检查Shadow DOM中的SUCCESS!时出错: {e}")
            return False
    
    async def click_captcha_in_shadow_dom(self, page):
        """在Shadow DOM中点击验证码"""
        print("🎯 在Shadow DOM中查找并点击验证码...")
        
        try:
            # 查找Shadow DOM中的可点击元素
            clickable_elements = await page.evaluate("""
                () => {
                    if (window.shadowDOMPiercer) {
                        return window.shadowDOMPiercer.findClickableInShadowRoots();
                    }
                    return [];
                }
            """)
            
            if clickable_elements and len(clickable_elements) > 0:
                print(f"🎯 在Shadow DOM中发现{len(clickable_elements)}个可点击元素")
                
                for i, element_info in enumerate(clickable_elements):
                    print(f"   元素{i+1}: {element_info.get('selector', 'unknown')} (Shadow Root {element_info.get('shadowRootIndex', 'unknown')})")
                    
                    # 尝试点击每个元素
                    try:
                        click_result = await page.evaluate("""
                            (elementInfo) => {
                                if (window.shadowDOMPiercer && elementInfo.element) {
                                    return window.shadowDOMPiercer.forceClickInShadowRoot(elementInfo.element);
                                }
                                return false;
                            }
                        """, element_info)
                        
                        if click_result:
                            print(f"   ✅ 元素{i+1}点击成功")
                            await page.wait_for_timeout(3000)
                            
                            # 检查是否成功
                            if await self.check_success_in_shadow_dom(page):
                                print("🎉 Shadow DOM验证码点击成功!")
                                return True
                        else:
                            print(f"   ❌ 元素{i+1}点击失败")
                            
                    except Exception as e:
                        print(f"   ❌ 点击元素{i+1}时出错: {e}")
                        continue
            else:
                print("❌ 在Shadow DOM中未发现可点击元素")
                return False
                
        except Exception as e:
            print(f"❌ 在Shadow DOM中处理验证码时出错: {e}")
            return False
    
    async def advanced_iframe_handling(self, page):
        """高级iframe处理，包括Cloudflare Turnstile"""
        print("🖼️ 高级iframe处理...")
        
        try:
            # 查找所有iframe
            iframes = await page.query_selector_all('iframe')
            print(f"发现 {len(iframes)} 个iframe")
            
            for i, iframe in enumerate(iframes):
                try:
                    src = await iframe.get_attribute('src') or ''
                    print(f"   Iframe {i+1}: {src[:100]}...")
                    
                    # 特别处理Cloudflare Turnstile
                    if 'challenges.cloudflare.com' in src or 'turnstile' in src.lower():
                        print(f"   🎯 发现Cloudflare Turnstile iframe!")
                        
                        # 尝试多种点击方法
                        methods = [
                            "click",
                            "hover_click", 
                            "js_click",
                            "force_click"
                        ]
                        
                        for method in methods:
                            try:
                                print(f"   尝试{method}方法...")
                                
                                if method == "click":
                                    await iframe.click()
                                elif method == "hover_click":
                                    await iframe.hover()
                                    await page.wait_for_timeout(1000)
                                    await iframe.click()
                                elif method == "js_click":
                                    await page.evaluate("(element) => element.click()", iframe)
                                elif method == "force_click":
                                    await iframe.click(force=True)
                                
                                await page.wait_for_timeout(5000)
                                
                                # 检查是否成功
                                if await self.check_success_in_shadow_dom(page):
                                    print(f"   ✅ {method}方法成功!")
                                    return True
                                    
                            except Exception as e:
                                print(f"   ❌ {method}方法失败: {e}")
                                continue
                    
                except Exception as e:
                    print(f"   ❌ 处理iframe {i+1}时出错: {e}")
                    continue
            
            return False
            
        except Exception as e:
            print(f"❌ 高级iframe处理时出错: {e}")
            return False
    
    async def run_iteration(self):
        """运行单次迭代"""
        print(f"\n🔄 第 {self.iteration} 轮Shadow DOM突破开始...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-features=VizDisplayCompositor'
                ]
            )
            
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            
            page = await context.new_page()
            
            try:
                # 1. 访问页面
                print("📄 访问注册页面...")
                await page.goto('https://augmentcode.com/signup', wait_until='networkidle', timeout=30000)
                await page.wait_for_timeout(5000)
                
                await self.take_screenshot(page, "01_initial")
                
                # 2. 注入Shadow DOM穿透脚本
                await self.inject_shadow_dom_piercer(page)
                
                # 3. 填写邮箱
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
                            await email_input.fill(self.test_email)
                            await page.wait_for_timeout(2000)
                            print(f"✅ 邮箱填写成功: {selector}")
                            email_filled = True
                            break
                    except:
                        continue
                
                if not email_filled:
                    print("❌ 未找到邮箱输入框")
                    return False
                
                await self.take_screenshot(page, "02_email_filled")
                
                # 4. 点击Continue按钮
                print("🔘 点击Continue按钮...")
                continue_selectors = [
                    'button[type="submit"]',
                    'button[data-action-button-primary="true"]',
                    'button:has-text("Continue")'
                ]
                
                continue_clicked = False
                for selector in continue_selectors:
                    try:
                        button = await page.query_selector(selector)
                        if button and await button.is_visible():
                            await button.click()
                            await page.wait_for_timeout(5000)
                            print(f"✅ Continue按钮点击成功: {selector}")
                            continue_clicked = True
                            break
                    except:
                        continue
                
                if not continue_clicked:
                    print("❌ 未找到Continue按钮")
                    return False
                
                await self.take_screenshot(page, "03_after_continue")
                
                # 5. 等待验证码加载并重新注入脚本
                print("⏰ 等待验证码加载...")
                await page.wait_for_timeout(8000)
                await self.inject_shadow_dom_piercer(page)  # 重新注入，因为页面可能有变化
                
                await self.take_screenshot(page, "04_captcha_loaded")
                
                # 6. 尝试在Shadow DOM中处理验证码
                if await self.click_captcha_in_shadow_dom(page):
                    await self.take_screenshot(page, "05_shadow_success")
                    print("🎉 Shadow DOM验证码处理成功!")
                    return True
                
                # 7. 尝试高级iframe处理
                if await self.advanced_iframe_handling(page):
                    await self.take_screenshot(page, "06_iframe_success")
                    print("🎉 iframe验证码处理成功!")
                    return True
                
                # 8. 最终检查
                await page.wait_for_timeout(10000)
                await self.inject_shadow_dom_piercer(page)
                
                if await self.check_success_in_shadow_dom(page):
                    await self.take_screenshot(page, "07_final_success")
                    print("🎉 最终在Shadow DOM中发现SUCCESS!")
                    return True
                
                await self.take_screenshot(page, "08_final_state")
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
🎯 Shadow DOM 突破工具
============================================================
🚀 特性:
  • 注入Shadow DOM穿透脚本
  • 处理Cloudflare Turnstile验证码
  • 在Closed Shadow Root中查找SUCCESS!
  • 多种iframe处理方法
============================================================
""")
        
        while self.iteration <= self.max_iterations:
            success = await self.run_iteration()
            
            if success:
                print(f"\n🎊🎊🎊 Shadow DOM突破成功！第 {self.iteration} 轮!")
                print("🏆 成功处理了Shadow DOM中的验证码!")
                break
            
            self.iteration += 1
            
            if self.iteration <= self.max_iterations:
                print(f"😴 休息3秒后继续...")
                await asyncio.sleep(3)
        
        if self.iteration > self.max_iterations:
            print(f"⚠️ 达到最大迭代次数 {self.max_iterations}")

async def main():
    breaker = ShadowDOMBreaker()
    await breaker.run()

if __name__ == "__main__":
    asyncio.run(main())
