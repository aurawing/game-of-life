# Aurai（Android）

基于 **Capacitor 8.5.0** 与 **DeepSeek Harness（npm `@deepseek-ai/dsh@0.1.1-rc.2`）** 架构的 Android Agent App。界面参考 ChatGPT / Claude / Manus 的移动端：底部输入框、左侧会话抽屉、思维链默认收起、点击后从底部弹出实时展示。

DeepSeek 官方 Harness 是 Node/Cordis 桌面运行时（`npx @deepseek-ai/dsh web`），无法直接塞进 WebView。本应用在设备内实现同一套核心模型：

- 插件化工具注册（Everything is a Plugin）
- 仅追加的会话消息 / 工具轨迹
- Agent loop：模型流式输出 → 工具调用 → 再请求
- 自定义 Provider（OpenAI 兼容）
- GitHub `topic:dsh-plugin` 插件中心
- 自定义 MCP（JSON-RPC `initialize` / `tools/list` / `tools/call`）

## 功能

| 能力 | 说明 |
| --- | --- |
| 自定义 Provider / Model | DeepSeek 默认 `deepseek-v4-flash` / `deepseek-v4-pro`，可添加任意兼容端点 |
| 思维强度 | none / low / medium / high / max → `thinking` + `reasoning_effort` |
| 会话管理与归档 | 新建、搜索、归档、恢复、删除 |
| 系统提示词 | 全局 + 单会话覆盖 |
| 附件 | 拍照、相册、文件、文本片段；图片走 `image_url` |
| 插件中心 | GitHub `topic:dsh-plugin`，失败则回退 [dsh.works reef catalog](https://dsh.works/awesome-dsh-plugins/) |
| 自定义 MCP | 添加 HTTP MCP 服务器并连接拉取工具 |
| 思维链 | 默认收起为「已思考 Ns」，点击底部 Sheet 展开；流式实时刷新 |
| 对话流式 | `reasoning_content` 与 `content` 分通道 SSE |
| 语音输入 | Web Speech API（Android WebView + `RECORD_AUDIO`） |

## 本地 Web 预览

```bash
npm install
npm test
npm run dev
```

打开设置，填入 DeepSeek API Key，即可对话。

## 打 Android 包

需要 Android SDK（compileSdk 36）。一键：

```bash
export ANDROID_HOME=$HOME/android-sdk
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
npm run android:apk
```

产物：

- `android/app/build/outputs/apk/debug/app-debug.apk`
- 仓库内副本 `artifacts/aurai-debug.apk`（包名 `ai.dsh.agent`，minSdk 24）

## 功能测试

```bash
npm test          # 单元：SSE / 工具 / 市场
npm run test:e2e  # Playwright Pixel 7：会话、设置、插件、MCP、思维链、流式、附件、语音入口
```

测试覆盖见 `artifacts/TEST-REPORT.md`。

原生模块 `SsePlugin` 用 `HttpURLConnection` 做 SSE，避开 WebView CORS，保证思维链与正文实时输出。

## 插件中心实现

DeepSeek 没有官方第一方商店，生态约定是 GitHub topic [`dsh-plugin`](https://github.com/topics/dsh-plugin)。本应用按社区 Marketplace（如 `ouyangyipeng/dsh-marketplace`、`AwesomeHou/dsh-plugin-marketplace`）同样的发现方式：

1. `GET https://api.github.com/search/repositories?q=topic:dsh-plugin`
2. 回退 `https://dsh.works/awesome-dsh-plugins/plugins.json`
3. 「安装」把 `github:owner/repo` 或 npm spec 写入本地插件清单并启用

内置可运行插件：网页搜索、抓取 URL、计算器、时间。社区 Node 组合包无法在 Android 进程内执行 pnpm install；它们作为清单/技能保留，若插件提供 MCP HTTP 端点，请到 MCP 页连接。

## DeepSeek API

```json
{
  "model": "deepseek-v4-flash",
  "stream": true,
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high"
}
```

流式 delta 使用 `reasoning_content` 与 `content` 两个字段。

## 版本钉扎

- Capacitor `@capacitor/core` **8.5.0**（当前 latest）
- DeepSeek Harness CLI **0.1.1-rc.2**（npm latest；0.1.2-alpha.1 未发布到 npm）
