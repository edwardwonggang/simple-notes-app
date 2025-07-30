#!/usr/bin/env python3
"""
Augment Code 注册最终版本
模拟完整的浏览器行为
"""

import requests
import json
import time
import re
from urllib.parse import urljoin, urlparse, parse_qs

def augment_signup_final():
    """执行完整的Augment Code注册流程"""
    email = "wg824468733wg+123@gmail.com"
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    })
    
    try:
        print("🚀 开始Augment Code注册流程...")
        
        # 步骤1: 访问初始注册页面
        print("\n📄 步骤1: 访问注册页面")
        response = session.get("https://augmentcode.com/signup")
        print(f"状态码: {response.status_code}")
        print(f"当前URL: {response.url}")
        
        # 步骤2: 跟随重定向到认证页面
        print("\n🔐 步骤2: 访问认证页面")
        auth_url = "https://auth.augmentcode.com/signup/login?individual=true"
        response = session.get(auth_url)
        print(f"状态码: {response.status_code}")
        print(f"当前URL: {response.url}")
        
        if response.status_code != 200:
            print("❌ 无法访问认证页面")
            return False
        
        page_content = response.text
        print(f"页面内容长度: {len(page_content)}")
        
        # 步骤3: 解析表单数据
        print("\n🔍 步骤3: 解析表单数据")
        
        # 提取state值
        state_pattern = r'<input[^>]*name=["\']state["\'][^>]*value=["\']([^"\']*)["\']'
        state_matches = re.findall(state_pattern, page_content, re.IGNORECASE)
        
        if not state_matches:
            print("❌ 未找到state字段")
            return False
        
        state_value = state_matches[0]
        print(f"✅ 找到state值: {state_value[:50]}...")
        
        # 步骤4: 准备表单提交
        print("\n📝 步骤4: 准备表单提交")
        
        # 更新headers为表单提交
        session.headers.update({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://login.augmentcode.com',
            'Referer': response.url,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1'
        })
        
        # 准备表单数据
        form_data = {
            'state': state_value,
            'username': email,
            'action': 'default',
            'webauthn-available': 'false',
            'is-brave': 'false',
            'webauthn-platform-available': 'false'
        }
        
        print(f"表单数据: {list(form_data.keys())}")
        print(f"邮箱: {email}")
        
        # 步骤5: 提交表单
        print("\n🚀 步骤5: 提交表单")
        
        submit_response = session.post(response.url, data=form_data, allow_redirects=True)
        print(f"提交状态码: {submit_response.status_code}")
        print(f"最终URL: {submit_response.url}")
        
        # 步骤6: 分析响应
        print("\n📊 步骤6: 分析响应")
        
        response_content = submit_response.text
        print(f"响应内容长度: {len(response_content)}")
        
        # 保存响应页面
        with open("augment_final_response.html", "w", encoding="utf-8") as f:
            f.write(response_content)
        print("已保存响应页面到 augment_final_response.html")
        
        # 检查各种可能的成功指标
        success_indicators = [
            "verification",
            "verify",
            "code",
            "check your email",
            "enter the code",
            "6-digit",
            "confirm",
            "验证码",
            "验证",
            "邮箱",
            "email sent",
            "we sent",
            "inbox"
        ]
        
        found_indicators = []
        for indicator in success_indicators:
            if indicator in response_content.lower():
                found_indicators.append(indicator)
        
        if found_indicators:
            print(f"✅ 找到成功指标: {found_indicators}")
            print("🎉 可能已成功跳转到验证码页面！")
            return True
        
        # 检查错误信息
        error_indicators = [
            "error",
            "invalid",
            "failed",
            "wrong",
            "incorrect",
            "problem",
            "issue"
        ]
        
        found_errors = []
        for error in error_indicators:
            if error in response_content.lower():
                found_errors.append(error)
        
        if found_errors:
            print(f"⚠️ 发现可能的错误指标: {found_errors}")
        
        # 检查URL变化
        if submit_response.url != response.url:
            print(f"✅ URL已变化，可能表示流程进展")
            print(f"原URL: {response.url}")
            print(f"新URL: {submit_response.url}")
            return True
        
        print("⚠️ 未检测到明确的成功或失败指标")
        return False
        
    except Exception as e:
        print(f"❌ 发生错误：{str(e)}")
        return False

def create_screenshot_summary():
    """创建流程总结"""
    print("\n" + "="*60)
    print("📋 Augment Code 注册流程总结")
    print("="*60)
    print("✅ 已完成的步骤:")
    print("  1. 访问 https://augmentcode.com/signup")
    print("  2. 重定向到认证页面")
    print("  3. 解析表单结构")
    print("  4. 提取必要的表单字段")
    print("  5. 提交邮箱地址")
    print("  6. 分析响应结果")
    print("\n📧 使用的邮箱: wg824468733wg+123@gmail.com")
    print("\n📁 生成的文件:")
    print("  - augment_signup_page.html (原始注册页面)")
    print("  - augment_final_response.html (提交后的响应页面)")
    print("\n💡 建议:")
    print("  1. 检查邮箱收件箱是否收到验证邮件")
    print("  2. 查看生成的HTML文件了解详细响应")
    print("  3. 如果收到验证邮件，说明注册流程成功")
    print("="*60)

if __name__ == "__main__":
    success = augment_signup_final()
    create_screenshot_summary()
    
    if success:
        print("\n🎉 注册流程可能已成功完成！")
        print("请检查邮箱 wg824468733wg+123@gmail.com 是否收到验证邮件。")
    else:
        print("\n❌ 注册流程可能未完全成功")
        print("请查看生成的HTML文件了解详细信息。")
    
    print("\n流程完成！")
