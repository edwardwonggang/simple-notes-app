#!/usr/bin/env python3
"""
Augment Code 注册简化版本
使用requests库模拟注册流程
"""

import requests
import json
import time
from urllib.parse import urljoin, urlparse

def augment_signup_simple():
    """执行简化的Augment Code注册流程"""
    email = "wg824468733wg+123@gmail.com"
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
    })
    
    try:
        print("正在访问Augment Code注册页面...")
        
        # 1. 访问初始注册页面
        response = session.get("https://augmentcode.com/signup")
        print(f"初始页面状态码: {response.status_code}")
        print(f"初始页面URL: {response.url}")
        
        # 2. 跟随重定向到实际注册页面
        if "auth.augmentcode.com" in response.url:
            print("已重定向到认证页面")
        else:
            # 手动访问认证页面
            auth_url = "https://auth.augmentcode.com/signup/login?individual=true"
            print(f"正在访问认证页面: {auth_url}")
            response = session.get(auth_url)
            print(f"认证页面状态码: {response.status_code}")
        
        # 3. 分析页面内容
        page_content = response.text
        print(f"页面内容长度: {len(page_content)}")
        
        # 查找表单和CSRF token
        if "email" in page_content.lower():
            print("✅ 找到邮箱相关内容")
        else:
            print("⚠️ 未找到邮箱相关内容")
            
        if "csrf" in page_content.lower() or "token" in page_content.lower():
            print("✅ 找到可能的CSRF token")
        else:
            print("⚠️ 未找到CSRF token")
        
        # 4. 尝试查找API端点
        print("\n正在分析页面中的JavaScript和API端点...")
        
        # 查找可能的API端点
        api_patterns = [
            "api/",
            "/api/",
            "signup",
            "register",
            "auth",
            "login"
        ]
        
        found_apis = []
        for pattern in api_patterns:
            if pattern in page_content:
                found_apis.append(pattern)
        
        if found_apis:
            print(f"找到可能的API端点: {found_apis}")
        else:
            print("未找到明显的API端点")
        
        # 5. 保存页面内容用于分析
        with open("augment_signup_page.html", "w", encoding="utf-8") as f:
            f.write(page_content)
        print("已保存页面内容到 augment_signup_page.html")
        
        # 6. 分析实际的表单结构
        import re

        # 查找state隐藏字段的值
        state_pattern = r'<input[^>]*name=["\']state["\'][^>]*value=["\']([^"\']*)["\'][^>]*>'
        state_matches = re.findall(state_pattern, page_content, re.IGNORECASE)

        if state_matches:
            state_value = state_matches[0]
            print(f"找到state值: {state_value[:50]}...")

            # 表单是POST到当前URL
            submit_url = response.url
            print(f"表单提交URL: {submit_url}")

            # 准备表单数据（基于实际的表单结构）
            form_data = {
                'state': state_value,
                'username': email,  # 邮箱字段名为username
                'action': 'default',  # 提交按钮的值
                'webauthn-available': 'false',
                'is-brave': 'false',
                'webauthn-platform-available': 'false'
            }

            print(f"准备提交表单数据: {list(form_data.keys())}")

            try:
                # 设置正确的headers
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': response.url,
                    'Origin': 'https://auth.augmentcode.com'
                }

                submit_response = session.post(submit_url, data=form_data, headers=headers, allow_redirects=True)
                print(f"提交状态码: {submit_response.status_code}")
                print(f"提交后URL: {submit_response.url}")

                if submit_response.status_code == 200:
                    print("✅ 表单提交成功")

                    # 检查是否跳转到验证码页面
                    response_content = submit_response.text
                    verification_keywords = [
                        "verification",
                        "verify",
                        "code",
                        "验证",
                        "验证码",
                        "confirm",
                        "check your email",
                        "enter the code",
                        "6-digit code"
                    ]

                    found_verification = any(keyword in response_content.lower()
                                           for keyword in verification_keywords)

                    if found_verification:
                        print("✅ 成功跳转到验证码页面！")

                        # 保存验证页面
                        with open("augment_verification_page.html", "w", encoding="utf-8") as f:
                            f.write(response_content)
                        print("已保存验证页面到 augment_verification_page.html")

                        return True
                    else:
                        print("⚠️ 未检测到验证码页面特征，但表单提交成功")
                        print(f"响应内容长度: {len(response_content)}")

                        # 保存响应页面用于分析
                        with open("augment_response_page.html", "w", encoding="utf-8") as f:
                            f.write(response_content)
                        print("已保存响应页面到 augment_response_page.html")

                        return True
                else:
                    print(f"❌ 表单提交失败，状态码: {submit_response.status_code}")
                    print(f"响应内容: {submit_response.text[:500]}...")

            except Exception as e:
                print(f"表单提交出错: {e}")
        else:
            print("未找到state隐藏字段")
        
        return False
        
    except Exception as e:
        print(f"❌ 发生错误：{str(e)}")
        return False

if __name__ == "__main__":
    print("开始Augment Code注册简化流程...")
    success = augment_signup_simple()
    if success:
        print("🎉 注册流程可能成功完成！")
    else:
        print("❌ 注册流程未能完成")
    print("简化流程完成！")
