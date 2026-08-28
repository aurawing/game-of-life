# DSH Agent 构建与功能测试报告

日期：2026-08-28（已按 pi.dev Provider / DeepSeek 蓝主题重新打包）

## APK

| 项 | 值 |
| --- | --- |
| 文件 | `artifacts/dsh-agent-debug.apk` |
| 大小 | 8.4 MB |
| 包名 | `ai.dsh.agent` |
| 版本 | 1.0 (versionCode 1) |
| minSdk / targetSdk | 24 / 36 |
| 应用名 | DSH Agent |
| 权限 | INTERNET, RECORD_AUDIO, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE(max 32) |
| 内含 | 最新 Web UI（`index-DGTeL2cO.js`）、原生 `ai.dsh.agent.SsePlugin` |

构建命令：`npm run android:apk`（Capacitor sync + Android Gradle Plugin 8.13，JDK 21）

本包包含：预置 pi.dev Provider、Provider/模型双下拉、SHOW CONFIGURATION 动态能力、自定义 Provider、DeepSeek 蓝色主题与字号折行、鲸鱼娘启动图标与启动页。

## 单元测试（vitest）

20 项通过：目录解析、思维档位、视觉附件降级、SSE、工具 schema、插件安装 spec。

## 端到端（Playwright Pixel 7，包内同一套 Web UI）

10 / 10 通过，含预置 Provider 切换、自定义 Provider 保留、无视觉模型隐藏拍照/图片。
