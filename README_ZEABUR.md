# Zeabur 部署指南

本项目已经适配 Zeabur 部署，并针对 Zeabur AI Hub 的 Gemini 系列模型进行了优化。

## 1. 环境变量配置 (关键)

在 Zeabur 服务的 **Variables (环境变量)** 页面中，必须添加以下变量：

| 变量名 | 示例值 | 说明 |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `sk-4WKOo738u5xEMF8qv7ZX1Q` | 您的 Zeabur AI Hub Key |
| `GEMINI_API_BASE_URL` | `https://api.zeabur.com/gemini/v1` | **必须设置**，Zeabur Gemini 代理地址 |

## 2. 模型配置说明

项目中已配置使用以下 Zeabur AI Hub 支持的模型：
- **文本/对话/分析**：`gemini-3-flash-preview`
- **图像生成**：`gemini-2.5-flash-image`

*注意：语音生成 (TTS) 功能目前使用的是 `gemini-2.5-flash-preview-tts`，如果 Zeabur AI Hub 不支持此模型，语音功能可能无法正常使用。*

## 3. 部署步骤

1. **准备代码**：确保所有修改已提交。
2. **创建服务**：在 Zeabur 创建新服务。
3. **设置变量**：进入服务的 `Variables` 选项卡，填入上述环境变量。
4. **绑定域名**：在 `Domain` 选项卡为项目绑定一个域名（如 `xxx.zeabur.app`）。
5. **部署**：Zeabur 会自动识别 Vite 项目并进行构建部署。

## 4. 本地开发

本地开发时，在项目根目录创建 `.env` 文件：

```bash
GEMINI_API_KEY=sk-4WKOo738u5xEMF8qv7ZX1Q
GEMINI_API_BASE_URL=https://api.zeabur.com/gemini/v1
```

然后运行：
```bash
npm install
npm run dev
```
