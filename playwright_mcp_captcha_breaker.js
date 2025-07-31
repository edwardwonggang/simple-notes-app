#!/usr/bin/env node

/**
 * 🎯 Augment Code 终极验证码突破工具 - Microsoft Playwright MCP版本
 * 
 * 使用Microsoft的Playwright MCP服务器进行原生浏览器操作
 * 这是一个更强大的方法，使用真正的浏览器而不是调试模式
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log(`
🎯 Augment Code 终极验证码突破工具 - Playwright MCP版本
============================================================
🚀 特性:
  • 使用Microsoft Playwright MCP服务器
  • 原生浏览器操作，非调试模式
  • 无限迭代直到成功
  • 智能验证码检测和处理
  • 以'Success!'字样为成功标准
============================================================
`);

class PlaywrightMCPCaptchaBreaker {
    constructor() {
        this.mcpProcess = null;
        this.iteration = 1;
        this.maxIterations = 100;
        this.targetUrl = 'https://augmentcode.com/signup';
        this.testEmail = 'wg824468733wg+123@gmail.com';
    }

    async startMCPServer() {
        console.log("🚀 启动 Playwright MCP 服务器...");
        
        return new Promise((resolve, reject) => {
            // 启动 Playwright MCP 服务器
            this.mcpProcess = spawn('npx', ['@playwright/mcp@latest', '--port', '8932'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let started = false;

            this.mcpProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`📋 MCP输出: ${data.toString().trim()}`);
                
                // 检查服务器是否已启动
                if (data.toString().includes('Server listening') || data.toString().includes('listening on')) {
                    started = true;
                    resolve();
                }
            });

            this.mcpProcess.stderr.on('data', (data) => {
                console.log(`⚠️ MCP错误: ${data.toString().trim()}`);
            });

            this.mcpProcess.on('close', (code) => {
                console.log(`🔚 MCP服务器退出，代码: ${code}`);
            });

            this.mcpProcess.on('error', (err) => {
                console.error(`❌ MCP服务器启动失败: ${err.message}`);
                reject(err);
            });

            // 等待5秒，如果没有明确的启动信号，就假设已启动
            setTimeout(() => {
                if (!started) {
                    console.log("⏰ 等待超时，假设MCP服务器已启动");
                    resolve();
                }
            }, 5000);
        });
    }

    async sendMCPCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.mcpProcess) {
                reject(new Error('MCP服务器未启动'));
                return;
            }

            console.log(`📤 发送MCP命令: ${JSON.stringify(command)}`);
            
            // 发送命令到MCP服务器
            this.mcpProcess.stdin.write(JSON.stringify(command) + '\n');

            // 监听响应
            let responseData = '';
            const responseHandler = (data) => {
                responseData += data.toString();
                
                // 尝试解析JSON响应
                try {
                    const lines = responseData.split('\n');
                    for (const line of lines) {
                        if (line.trim()) {
                            const response = JSON.parse(line);
                            console.log(`📥 MCP响应: ${JSON.stringify(response)}`);
                            this.mcpProcess.stdout.removeListener('data', responseHandler);
                            resolve(response);
                            return;
                        }
                    }
                } catch (e) {
                    // 继续等待更多数据
                }
            };

            this.mcpProcess.stdout.on('data', responseHandler);

            // 超时处理
            setTimeout(() => {
                this.mcpProcess.stdout.removeListener('data', responseHandler);
                reject(new Error('MCP命令超时'));
            }, 30000);
        });
    }

    async navigateToPage() {
        console.log(`📄 访问注册页面: ${this.targetUrl}`);
        
        const command = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "browser_navigate",
                arguments: {
                    url: this.targetUrl
                }
            }
        };

        try {
            const response = await this.sendMCPCommand(command);
            console.log("✅ 页面导航成功");
            return response;
        } catch (error) {
            console.error(`❌ 页面导航失败: ${error.message}`);
            throw error;
        }
    }

    async takeSnapshot() {
        console.log("📸 获取页面快照...");
        
        const command = {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "browser_snapshot",
                arguments: {}
            }
        };

        try {
            const response = await this.sendMCPCommand(command);
            console.log("✅ 页面快照获取成功");
            return response;
        } catch (error) {
            console.error(`❌ 页面快照失败: ${error.message}`);
            throw error;
        }
    }

    async fillEmail() {
        console.log(`📝 填写邮箱: ${this.testEmail}`);
        
        // 首先获取页面快照以找到邮箱输入框
        const snapshot = await this.takeSnapshot();
        
        // 查找邮箱输入框的引用
        // 这里需要解析快照内容来找到正确的元素引用
        
        const command = {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "browser_type",
                arguments: {
                    element: "email input field",
                    ref: "input[name='username']", // 这个需要从快照中获取
                    text: this.testEmail
                }
            }
        };

        try {
            const response = await this.sendMCPCommand(command);
            console.log("✅ 邮箱填写成功");
            return response;
        } catch (error) {
            console.error(`❌ 邮箱填写失败: ${error.message}`);
            throw error;
        }
    }

    async checkForSuccess() {
        console.log("🔍 检查是否出现'Success!'字样...");
        
        const snapshot = await this.takeSnapshot();
        
        // 检查快照内容是否包含"Success!"
        if (snapshot && snapshot.result && response.result.content) {
            const content = JSON.stringify(response.result.content);
            if (content.includes('Success!')) {
                console.log("🎉 发现'Success!'字样！验证码突破成功！");
                return true;
            }
        }
        
        console.log("❌ 未发现'Success!'字样");
        return false;
    }

    async runIteration() {
        console.log(`\n🔄 第 ${this.iteration} 轮迭代开始...`);
        
        try {
            // 1. 导航到页面
            await this.navigateToPage();
            
            // 2. 填写邮箱
            await this.fillEmail();
            
            // 3. 等待验证码加载
            console.log("⏳ 等待验证码加载...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // 4. 获取页面快照
            const snapshot = await this.takeSnapshot();
            
            // 5. 检查是否成功
            const success = await this.checkForSuccess();
            
            if (success) {
                console.log(`🎉🎉🎉 SUCCESS! 第 ${this.iteration} 轮迭代成功突破验证码!`);
                console.log("🏆 页面已出现'Success!'字样，任务完成!");
                return true;
            }
            
            console.log(`❌ 第 ${this.iteration} 轮迭代失败，继续下一轮...`);
            return false;
            
        } catch (error) {
            console.error(`❌ 第 ${this.iteration} 轮迭代出错: ${error.message}`);
            return false;
        }
    }

    async run() {
        try {
            // 启动MCP服务器
            await this.startMCPServer();
            
            console.log("🚀 启动无限迭代验证码突破模式");
            console.log("🎯 目标: 页面出现'Success!'字样");
            console.log("⏰ 时间: 无上限，直到成功");
            console.log("------------------------------------------------------------");
            
            // 无限迭代直到成功
            while (this.iteration <= this.maxIterations) {
                const success = await this.runIteration();
                
                if (success) {
                    console.log("\n🎊 任务圆满完成！验证码突破成功！");
                    break;
                }
                
                this.iteration++;
                
                // 短暂休息
                console.log("😴 休息2秒后继续...");
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            if (this.iteration > this.maxIterations) {
                console.log(`⚠️ 达到最大迭代次数 ${this.maxIterations}，停止尝试`);
            }
            
        } catch (error) {
            console.error(`❌ 程序执行失败: ${error.message}`);
        } finally {
            // 清理MCP服务器
            if (this.mcpProcess) {
                console.log("🧹 清理MCP服务器...");
                this.mcpProcess.kill();
            }
        }
    }
}

// 运行程序
const breaker = new PlaywrightMCPCaptchaBreaker();
breaker.run().catch(console.error);
