# Aurai 构建与功能测试报告

日期：2026-08-28（OpenCode Go 空回复：SSE 失败后回退 JSON）

## APK

| 项 | 值 |
| --- | --- |
| 文件 | `artifacts/aurai-debug.apk` |
| 大小 | 11 MB |
| 包名 | `ai.dsh.agent` |
| 版本 | 1.0 (versionCode 1) |
| minSdk / targetSdk | 24 / 36 |
| 应用名 | Aurai |

本包：流式为空时用 CapacitorHttp 非流式 JSON 重试；OpenCode Go `text/plain` 401 会显示「请求失败」；发送后短暂禁用停止键。

## 测试

- 单元：29 通过
- e2e：12 / 12 通过（含 OpenCode Go 明文 JSON 401、空 SSE 回退 JSON 正文）
