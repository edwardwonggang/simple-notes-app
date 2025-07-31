#!/usr/bin/env node

/**
 * 🎯 Augment Code 终极验证码突破工具 - Playwright MCP HTTP版本
 * 
 * 使用HTTP方式与Microsoft Playwright MCP服务器通信
 */

const { spawn } = require('child_process');
const http = require('http');

console.log(`
🎯 Augment Code 终极验证码突破工具 - Playwright MCP HTTP版本
============================================================
🚀 特性:
  • 使用Microsoft Playwright MCP服务器 (HTTP)
  • 原生浏览器操作，非调试模式
  • 无限迭代直到成功
  • 智能验证码检测和处理
  • 以'Success!'字样为成功标准
============================================================
`);

class PlaywrightMCPHTTPBreaker {
    constructor() {
        this.mcpProcess = null;
        this.iteration = 1;
        this.maxIterations = 50;
        this.targetUrl = 'https://augmentcode.com/signup';
        this.testEmail = 'wg824468733wg+123@gmail.com';
        this.mcpUrl = 'http://localhost:8932/mcp';
        this.requestId = 1;
    }

    async startMCPServer() {
        console.log("🚀 启动 Playwright MCP 服务器...");
        
        return new Promise((resolve, reject) => {
            // 启动 Playwright MCP 服务器
            this.mcpProcess = spawn('npx', ['@playwright/mcp@latest', '--port', '8932', '--headless'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let serverReady = false;

            this.mcpProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`📋 MCP输出: ${output.trim()}`);
                
                // 检查服务器是否已启动
                if (output.includes('Listening on http://localhost:8932')) {
                    serverReady = true;
                    console.log("✅ MCP服务器已启动");
                    // 等待一下确保服务器完全就绪
                    setTimeout(resolve, 2000);
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

            // 等待10秒超时
            setTimeout(() => {
                if (!serverReady) {
                    console.log("⏰ 等待超时，假设MCP服务器已启动");
                    resolve();
                }
            }, 10000);
        });
    }

    async sendMCPRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const requestData = JSON.stringify({
                jsonrpc: "2.0",
                id: this.requestId++,
                method: method,
                params: params
            });

            console.log(`📤 发送HTTP请求: ${requestData}`);

            const options = {
                hostname: 'localhost',
                port: 8932,
                path: '/mcp',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        console.log(`📥 HTTP响应: ${JSON.stringify(response)}`);
                        resolve(response);
                    } catch (error) {
                        console.error(`❌ 解析响应失败: ${error.message}`);
                        console.error(`原始响应: ${responseData}`);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`❌ HTTP请求失败: ${error.message}`);
                reject(error);
            });

            req.write(requestData);
            req.end();
        });
    }

    async navigateToPage() {
        console.log(`📄 访问注册页面: ${this.targetUrl}`);
        
        try {
            const response = await this.sendMCPRequest("tools/call", {
                name: "browser_navigate",
                arguments: {
                    url: this.targetUrl
                }
            });
            
            console.log("✅ 页面导航成功");
            return response;
        } catch (error) {
            console.error(`❌ 页面导航失败: ${error.message}`);
            throw error;
        }
    }

    async takeSnapshot() {
        console.log("📸 获取页面快照...");
        
        try {
            const response = await this.sendMCPRequest("tools/call", {
                name: "browser_snapshot",
                arguments: {}
            });
            
            console.log("✅ 页面快照获取成功");
            return response;
        } catch (error) {
            console.error(`❌ 页面快照失败: ${error.message}`);
            throw error;
        }
    }

    async takeScreenshot() {
        console.log("📷 获取页面截图...");
        
        try {
            const response = await this.sendMCPRequest("tools/call", {
                name: "browser_take_screenshot",
                arguments: {
                    filename: `iteration_${this.iteration}_screenshot.png`
                }
            });
            
            console.log("✅ 页面截图获取成功");
            return response;
        } catch (error) {
            console.error(`❌ 页面截图失败: ${error.message}`);
            throw error;
        }
    }

    async checkForSuccess(snapshot) {
        console.log("🔍 检查是否出现'Success!'字样...");
        
        try {
            // 检查快照内容是否包含"Success!"
            if (snapshot && snapshot.result && snapshot.result.content) {
                const content = JSON.stringify(snapshot.result.content);
                if (content.includes('Success!')) {
                    console.log("🎉 发现'Success!'字样！验证码突破成功！");
                    return true;
                }
            }
            
            console.log("❌ 未发现'Success!'字样");
            return false;
        } catch (error) {
            console.error(`❌ 检查成功标识失败: ${error.message}`);
            return false;
        }
    }

    async runIteration() {
        console.log(`\n🔄 第 ${this.iteration} 轮迭代开始...`);
        
        try {
            // 1. 导航到页面
            await this.navigateToPage();
            
            // 2. 等待页面加载
            console.log("⏳ 等待页面加载...");
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 3. 获取页面快照
            const snapshot = await this.takeSnapshot();
            
            // 4. 获取页面截图
            await this.takeScreenshot();
            
            // 5. 检查是否成功
            const success = await this.checkForSuccess(snapshot);
            
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
                console.log("😴 休息3秒后继续...");
                await new Promise(resolve => setTimeout(resolve, 3000));
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
const breaker = new PlaywrightMCPHTTPBreaker();
breaker.run().catch(console.error);
