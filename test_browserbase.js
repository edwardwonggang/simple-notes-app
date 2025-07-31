#!/usr/bin/env node

/**
 * 测试 Browserbase MCP 服务器
 * 这个脚本用于测试 browserbase MCP 是否可以正常工作
 */

console.log("🔍 测试 Browserbase MCP 服务器...");

// 检查是否安装了 browserbase MCP
try {
    const { spawn } = require('child_process');
    
    console.log("📦 检查 Browserbase MCP 安装...");
    
    // 尝试运行 npx @browserbasehq/mcp-server-browserbase --help
    const child = spawn('npx', ['@browserbasehq/mcp-server-browserbase', '--help'], {
        stdio: 'pipe'
    });
    
    let output = '';
    let error = '';
    
    child.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
        error += data.toString();
    });
    
    child.on('close', (code) => {
        console.log(`\n📋 命令执行结果 (退出码: ${code}):`);
        
        if (output) {
            console.log("✅ 标准输出:");
            console.log(output);
        }
        
        if (error) {
            console.log("⚠️ 错误输出:");
            console.log(error);
        }
        
        if (code === 0) {
            console.log("🎉 Browserbase MCP 服务器可用!");
            console.log("\n📝 下一步:");
            console.log("1. 获取 Browserbase API 密钥");
            console.log("2. 获取 Browserbase 项目 ID");
            console.log("3. 获取 Gemini API 密钥");
            console.log("4. 配置环境变量并运行");
        } else {
            console.log("❌ Browserbase MCP 服务器不可用");
        }
    });
    
    child.on('error', (err) => {
        console.error("❌ 执行错误:", err.message);
    });
    
} catch (error) {
    console.error("❌ 测试失败:", error.message);
}
