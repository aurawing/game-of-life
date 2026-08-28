# DSH Agent 构建与功能测试报告

日期：2026-08-28

## APK

| 项 | 值 |
| --- | --- |
| 文件 | `artifacts/dsh-agent-debug.apk` |
| 包名 | `ai.dsh.agent` |
| 版本 | 1.0 (versionCode 1) |
| minSdk / targetSdk | 24 / 36 |
| 应用名 | DSH Agent |
| 权限 | INTERNET, RECORD_AUDIO, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE(max 32) |
| 内含 | `assets/public/index.html`、原生 `ai.dsh.agent.SsePlugin` |

构建命令：`./gradlew :app:assembleDebug`（Android Gradle Plugin 8.13，JDK 21）

## 单元测试（vitest）

13 项通过：SSE 解析、思维强度映射、工具 schema、会话历史、插件安装 spec。

## 端到端（Playwright Pixel 7，包内同一套 Web UI）

| 用例 | 结果 |
| --- | --- |
| 首页、语音按钮、附件菜单（拍照/图片/文件/文本） | 通过 |
| 无 API Key 发送提示去设置 | 通过 |
| 会话新建、归档、恢复、删除、搜索 | 通过 |
| 自定义 Provider / Model、思维强度、系统提示词 | 通过 |
| 插件中心内置插件 + GitHub `topic:dsh-plugin` 市场 | 通过 |
| 自定义 MCP 添加、连接失败态、删除 | 通过 |
| 思维链默认收起，点击底部 Sheet 展开 | 通过 |
| Mock DeepSeek SSE：思维链 + 正文实时输出 | 通过 |
| 文本片段附件进入输入条 | 通过 |

9 / 9 通过。

## 测试中修复

思维强度「关闭」与页面关闭按钮同名，已改为「不思考」，避免误点。
