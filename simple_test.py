#!/usr/bin/env python3
"""
简单测试脚本 - 验证Playwright是否正常工作
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    print("🔍 测试Playwright...")
    
    try:
        async with async_playwright() as p:
            print("✅ Playwright启动成功")
            
            browser = await p.chromium.launch(headless=True)
            print("✅ 浏览器启动成功")
            
            page = await browser.new_page()
            print("✅ 页面创建成功")
            
            await page.goto('https://login.augmentcode.com/u/login/identifier')
            print("✅ 页面访问成功")
            
            title = await page.title()
            print(f"✅ 页面标题: {title}")
            
            url = page.url
            print(f"✅ 当前URL: {url}")
            
            # 截图
            await page.screenshot(path='test_screenshot.png')
            print("✅ 截图成功: test_screenshot.png")
            
            await browser.close()
            print("✅ 浏览器关闭成功")
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")

if __name__ == "__main__":
    asyncio.run(main())
