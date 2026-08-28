# Aurai 构建与功能测试报告

日期：2026-08-28（已修复 OpenCode Go + DeepSeek 空回复并重新打包）

## APK

| 项 | 值 |
| --- | --- |
| 文件 | `artifacts/aurai-debug.apk` |
| 大小 | 11 MB |
| 包名 | `ai.dsh.agent` |
| 版本 | 1.0 (versionCode 1) |
| minSdk / targetSdk | 24 / 36 |
| 应用名 | Aurai |
| 权限 | INTERNET, RECORD_AUDIO, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE(max 32) |
| 内含 | 最新 Web UI、原生 `SsePlugin`（JSON 错误不再被吞掉）、`VoicePlugin` |

构建命令：`npm run android:apk`（Capacitor sync + Android Gradle Plugin 8.13，JDK 21）

本包包含：预置 pi.dev Provider、预置 OpenCode Go、SHOW CONFIGURATION 动态能力、自定义 Provider、DeepSeek 蓝色主题、鲸鱼娘图标。OpenCode Go 请求不再携带 DeepSeek 专属 `thinking` 字段和过大的 `max_tokens`；接口 JSON 错误会显示在对话里。

## 单元测试（vitest）

28 项通过：目录解析、OpenCode Go 请求体、思维档位、SSE/JSON 错误解析、工具 schema、插件安装 spec。

## 端到端（Playwright Pixel 7，包内同一套 Web UI）

11 / 11 通过，含 OpenCode Go 省略 thinking 字段、JSON 401 显示「请求失败」、预置 Provider 切换、自定义 Provider 保留。
