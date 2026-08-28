# Aurai 构建与功能测试报告

日期：2026-08-28（OpenCode Go HTTP 401：规范化密钥、拒绝控制台掩码）

## APK

| 项 | 值 |
| --- | --- |
| 文件 | `artifacts/aurai-debug.apk` |
| 大小 | 11 MB |
| 包名 | `ai.dsh.agent` |
| 版本 | 1.0 (versionCode 1) |
| minSdk / targetSdk | 24 / 36 |
| 应用名 | Aurai |

本包：粘贴时去掉 `Bearer`/空白/引号；含 `...`/`…` 的控制台掩码不发请求；401 会附带位数诊断；设置里显示「已输入 N 位」和「测试连接」（`GET /models`）。

## 测试

- 单元：30 通过
- e2e：13 / 13 通过（含短密钥 401 提示、掩码 Key 拦截、空 SSE 回退 JSON）
