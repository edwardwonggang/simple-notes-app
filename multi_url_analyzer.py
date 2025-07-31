#!/usr/bin/env python3
"""
🔍 多URL分析工具
尝试不同的URL找到工作的登录页面
"""

import asyncio
from playwright.async_api import async_playwright

async def analyze_url(page, url, name):
    """分析单个URL"""
    print(f"\n🔍 分析 {name}: {url}")
    
    try:
        await page.goto(url, timeout=30000)
        await page.wait_for_timeout(5000)
        
        current_url = page.url
        page_title = await page.title()
        print(f"   📍 实际URL: {current_url}")
        print(f"   📄 页面标题: {page_title}")
        
        # 检查页面文本
        page_text = await page.evaluate("document.body.innerText")
        print(f"   📝 页面文本长度: {len(page_text)} 字符")
        
        # 检查是否有错误信息
        if 'error' in page_text.lower() or 'oops' in page_text.lower():
            print(f"   ❌ 页面包含错误信息")
            print(f"   错误内容: {page_text[:200]}")
            return False
        
        # 检查输入框
        all_inputs = await page.query_selector_all('input')
        print(f"   🔍 找到 {len(all_inputs)} 个输入框")
        
        email_inputs = []
        for i, input_elem in enumerate(all_inputs):
            try:
                input_type = await input_elem.get_attribute('type') or 'text'
                input_name = await input_elem.get_attribute('name') or ''
                input_id = await input_elem.get_attribute('id') or ''
                input_placeholder = await input_elem.get_attribute('placeholder') or ''
                is_visible = await input_elem.is_visible()
                
                if is_visible and (
                    input_type in ['email', 'text'] or
                    'email' in input_name.lower() or
                    'username' in input_name.lower() or
                    'email' in input_id.lower() or
                    'username' in input_id.lower() or
                    'email' in input_placeholder.lower()
                ):
                    email_inputs.append({
                        'index': i,
                        'type': input_type,
                        'name': input_name,
                        'id': input_id,
                        'placeholder': input_placeholder
                    })
                    print(f"      ✅ 可能的邮箱输入框 {i}: type={input_type}, name={input_name}, id={input_id}")
            except:
                continue
        
        # 检查按钮
        all_buttons = await page.query_selector_all('button')
        print(f"   🔘 找到 {len(all_buttons)} 个按钮")
        
        submit_buttons = []
        for i, button_elem in enumerate(all_buttons):
            try:
                button_type = await button_elem.get_attribute('type') or ''
                button_text = await button_elem.inner_text()
                is_visible = await button_elem.is_visible()
                
                if is_visible and (
                    button_type == 'submit' or
                    'continue' in button_text.lower() or
                    'submit' in button_text.lower() or
                    'login' in button_text.lower() or
                    'sign' in button_text.lower()
                ):
                    submit_buttons.append({
                        'index': i,
                        'type': button_type,
                        'text': button_text
                    })
                    print(f"      ✅ 可能的提交按钮 {i}: type={button_type}, text={button_text}")
            except:
                continue
        
        # 截图
        screenshot_name = f"url_analysis_{name.replace(' ', '_').lower()}.png"
        await page.screenshot(path=screenshot_name, full_page=True)
        print(f"   📸 截图: {screenshot_name}")
        
        # 如果找到了邮箱输入框和提交按钮，这个URL可能有用
        if email_inputs and submit_buttons:
            print(f"   ✅ {name} 看起来是一个有效的登录页面!")
            return True
        else:
            print(f"   ❌ {name} 不是有效的登录页面")
            return False
            
    except Exception as e:
        print(f"   ❌ 分析 {name} 失败: {e}")
        return False

async def main():
    print("🔍 多URL分析工具 - 寻找有效的登录页面")
    
    # 要测试的URL列表
    urls_to_test = [
        ('原始注册页面', 'https://augmentcode.com/signup'),
        ('Auth0登录页面', 'https://login.augmentcode.com/u/login/identifier'),
        ('Auth0注册页面', 'https://login.augmentcode.com/u/signup/identifier'),
        ('Auth0根页面', 'https://login.augmentcode.com/'),
        ('主站登录', 'https://augmentcode.com/login'),
        ('主站认证', 'https://augmentcode.com/auth'),
        ('主站用户', 'https://augmentcode.com/user'),
        ('主站账户', 'https://augmentcode.com/account'),
    ]
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        valid_urls = []
        
        for name, url in urls_to_test:
            is_valid = await analyze_url(page, url, name)
            if is_valid:
                valid_urls.append((name, url))
        
        print(f"\n📊 分析结果:")
        print(f"   总共测试了 {len(urls_to_test)} 个URL")
        print(f"   找到 {len(valid_urls)} 个有效的登录页面")
        
        if valid_urls:
            print(f"\n✅ 有效的登录页面:")
            for name, url in valid_urls:
                print(f"   • {name}: {url}")
        else:
            print(f"\n❌ 未找到有效的登录页面")
            print("   可能需要尝试其他方法或URL")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
