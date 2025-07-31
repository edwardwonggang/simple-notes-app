#!/usr/bin/env python3
"""
🔍 页面分析工具
分析Auth0页面的实际结构，找出所有可能的输入框和按钮
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    print("🔍 分析Auth0页面结构...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # 访问页面
        await page.goto('https://login.augmentcode.com/u/login/identifier', timeout=30000)
        await page.wait_for_timeout(5000)
        
        print(f"📄 页面标题: {await page.title()}")
        print(f"📍 当前URL: {page.url}")
        
        # 获取页面HTML
        html_content = await page.content()
        print(f"\n📝 页面HTML长度: {len(html_content)} 字符")
        
        # 分析所有输入框
        print("\n🔍 分析所有输入框:")
        all_inputs = await page.query_selector_all('input')
        print(f"   总共找到 {len(all_inputs)} 个input元素")
        
        for i, input_elem in enumerate(all_inputs):
            try:
                input_type = await input_elem.get_attribute('type') or 'text'
                input_name = await input_elem.get_attribute('name') or ''
                input_id = await input_elem.get_attribute('id') or ''
                input_class = await input_elem.get_attribute('class') or ''
                input_placeholder = await input_elem.get_attribute('placeholder') or ''
                is_visible = await input_elem.is_visible()
                
                print(f"   Input {i+1}:")
                print(f"      type='{input_type}'")
                print(f"      name='{input_name}'")
                print(f"      id='{input_id}'")
                print(f"      class='{input_class}'")
                print(f"      placeholder='{input_placeholder}'")
                print(f"      visible={is_visible}")
                print()
            except:
                print(f"   Input {i+1}: 无法获取属性")
        
        # 分析所有按钮
        print("\n🔍 分析所有按钮:")
        all_buttons = await page.query_selector_all('button')
        print(f"   总共找到 {len(all_buttons)} 个button元素")
        
        for i, button_elem in enumerate(all_buttons):
            try:
                button_type = await button_elem.get_attribute('type') or ''
                button_name = await button_elem.get_attribute('name') or ''
                button_id = await button_elem.get_attribute('id') or ''
                button_class = await button_elem.get_attribute('class') or ''
                button_text = await button_elem.inner_text()
                is_visible = await button_elem.is_visible()
                
                print(f"   Button {i+1}:")
                print(f"      type='{button_type}'")
                print(f"      name='{button_name}'")
                print(f"      id='{button_id}'")
                print(f"      class='{button_class}'")
                print(f"      text='{button_text}'")
                print(f"      visible={is_visible}")
                print()
            except:
                print(f"   Button {i+1}: 无法获取属性")
        
        # 分析所有表单
        print("\n🔍 分析所有表单:")
        all_forms = await page.query_selector_all('form')
        print(f"   总共找到 {len(all_forms)} 个form元素")
        
        for i, form_elem in enumerate(all_forms):
            try:
                form_action = await form_elem.get_attribute('action') or ''
                form_method = await form_elem.get_attribute('method') or ''
                form_id = await form_elem.get_attribute('id') or ''
                form_class = await form_elem.get_attribute('class') or ''
                
                print(f"   Form {i+1}:")
                print(f"      action='{form_action}'")
                print(f"      method='{form_method}'")
                print(f"      id='{form_id}'")
                print(f"      class='{form_class}'")
                print()
            except:
                print(f"   Form {i+1}: 无法获取属性")
        
        # 检查页面文本内容
        print("\n📝 页面可见文本内容:")
        page_text = await page.evaluate("document.body.innerText")
        print(f"   文本长度: {len(page_text)} 字符")
        print(f"   前500字符: {page_text[:500]}")
        
        # 检查是否有iframe
        print("\n🖼️ 检查iframe:")
        all_iframes = await page.query_selector_all('iframe')
        print(f"   总共找到 {len(all_iframes)} 个iframe元素")
        
        for i, iframe_elem in enumerate(all_iframes):
            try:
                iframe_src = await iframe_elem.get_attribute('src') or ''
                iframe_id = await iframe_elem.get_attribute('id') or ''
                iframe_class = await iframe_elem.get_attribute('class') or ''
                is_visible = await iframe_elem.is_visible()
                
                print(f"   Iframe {i+1}:")
                print(f"      src='{iframe_src}'")
                print(f"      id='{iframe_id}'")
                print(f"      class='{iframe_class}'")
                print(f"      visible={is_visible}")
                print()
            except:
                print(f"   Iframe {i+1}: 无法获取属性")
        
        # 等待更长时间看是否有动态加载
        print("\n⏰ 等待10秒观察动态加载...")
        await page.wait_for_timeout(10000)
        
        # 重新检查输入框
        print("\n🔍 10秒后重新检查输入框:")
        all_inputs_after = await page.query_selector_all('input')
        print(f"   现在找到 {len(all_inputs_after)} 个input元素")
        
        if len(all_inputs_after) > len(all_inputs):
            print("   ✅ 发现新的输入框!")
            for i in range(len(all_inputs), len(all_inputs_after)):
                input_elem = all_inputs_after[i]
                try:
                    input_type = await input_elem.get_attribute('type') or 'text'
                    input_name = await input_elem.get_attribute('name') or ''
                    input_id = await input_elem.get_attribute('id') or ''
                    is_visible = await input_elem.is_visible()
                    
                    print(f"   新Input {i+1}:")
                    print(f"      type='{input_type}'")
                    print(f"      name='{input_name}'")
                    print(f"      id='{input_id}'")
                    print(f"      visible={is_visible}")
                except:
                    pass
        
        # 截图
        await page.screenshot(path='page_analysis.png', full_page=True)
        print("\n📸 页面分析截图: page_analysis.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
