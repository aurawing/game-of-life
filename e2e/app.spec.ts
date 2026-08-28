import { test, expect, type Page } from '@playwright/test';

async function reset(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: '菜单' }).click();
}

async function closeOverlay(page: Page) {
  await page.locator('.page .page-head').getByRole('button', { name: '关闭' }).click();
}

test.describe('Aurai Android UI', () => {
  test('home, composer, voice and attach menu', async ({ page }) => {
    await reset(page);
    await expect(page.getByRole('heading', { name: '有什么可以帮忙的？' })).toBeVisible();
    await expect(page.getByLabel('提供商')).toHaveCount(0);
    await expect(page.getByLabel('模型')).toHaveCount(0);
    await expect(page.locator('.model-title')).toContainText('DeepSeek V4 Flash');
    await expect(page.getByText(/思维 高/)).toBeVisible();
    await expect(page.getByRole('button', { name: '语音输入' })).toBeVisible();
    await page.getByRole('button', { name: '附件' }).click();
    await expect(page.getByText('当前模型不支持视觉输入')).toBeVisible();
    await expect(page.getByRole('button', { name: /文件/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /文本片段/ })).toBeVisible();
  });

  test('OpenCode Go DeepSeek request omits thinking fields and surfaces json errors', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('设置提供商').selectOption('opencode-go');
    await page.getByLabel('API Key').fill('sk-go');
    await page.getByLabel('当前模型').selectOption('deepseek-v4-flash');
    await expect(page.getByText('该接口不接受思维强度参数，按服务端默认推理。')).toBeVisible();
    await closeOverlay(page);
    await expect(page.locator('.model-title')).toContainText('DeepSeek V4 Flash');
    await expect(page.getByText(/OpenCode Go/)).toBeVisible();

    let captured: Record<string, unknown> | null = null;
    await page.route(/\/chat\/completions$/, async (route) => {
      captured = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 401,
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ type: 'error', error: { type: 'AuthError', message: 'Invalid API key.' } }),
      });
    });

    await page.getByPlaceholder('发送消息').fill('你好');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/请求失败：.*Invalid API key/)).toBeVisible();
    expect(captured).toBeTruthy();
    expect(captured?.thinking).toBeUndefined();
    expect(captured?.max_tokens).toBeUndefined();
    expect(captured?.model).toBe('deepseek-v4-flash');
    expect(captured?.stream).toBe(true);
  });

  test('empty SSE falls back to non-stream JSON completion', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('设置提供商').selectOption('opencode-go');
    await page.getByLabel('API Key').fill('sk-go');
    await closeOverlay(page);

    await page.route(/\/chat\/completions$/, async (route) => {
      const json = route.request().postDataJSON() as { stream?: boolean };
      if (json.stream) {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: 'data: [DONE]\n\n',
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choices: [{ message: { content: '你好，我是 Aurai。' } }] }),
      });
    });

    await page.getByPlaceholder('发送消息').fill('你好');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText('你好，我是 Aurai。')).toBeVisible();
  });

  test('send without api key shows setup hint', async ({ page }) => {
    await reset(page);
    await page.getByPlaceholder('发送消息').fill('你好，帮我写一首诗');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText('请先在设置里填写 Provider API Key。')).toBeVisible();
  });

  test('masked console api key is rejected before network', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('API Key').fill('sk-hSmj...oGil');
    await closeOverlay(page);
    await page.getByPlaceholder('发送消息').fill('你好');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText(/控制台掩码|省略号/)).toBeVisible();
  });

  test('sessions: create, archive, restore, delete, search and per-chat prompt', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.locator('.drawer .primary-btn').click();
    await openMenu(page);
    await expect(page.locator('.session-row')).toHaveCount(2);
    await page.locator('.session-row').first().getByRole('button', { name: '系统提示词' }).click();
    await expect(page.getByText('本对话系统提示词')).toBeVisible();
    await page.getByLabel('本对话系统提示词').fill('你只回答诗歌。');
    await page.getByRole('button', { name: '保存' }).click();
    await page.locator('.session-row').first().getByRole('button', { name: '归档' }).click();
    await page.locator('.tabs').getByRole('button', { name: '归档' }).click();
    await expect(page.locator('.session-row')).toHaveCount(1);
    await page.locator('.session-row').getByRole('button', { name: '恢复' }).click();
    await page.locator('.tabs').getByRole('button', { name: '对话' }).click();
    await expect(page.locator('.session-row')).toHaveCount(2);
    const before = await page.locator('.session-row').count();
    await page.locator('.session-row').first().getByRole('button', { name: '删除' }).click();
    await expect(page.locator('.session-row')).toHaveCount(before - 1);
    await page.getByPlaceholder('搜索会话').fill('不存在的标题xyz');
    await expect(page.getByText('暂无会话')).toBeVisible();
  });

  test('settings: provider, model, thinking effort, system prompt, theme', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '设置' }).click();
    await expect(page.getByText('模型提供商')).toBeVisible();
    await expect(page.getByText('预置列表来自')).toHaveCount(0);
    await expect(page.getByText('预置模型参数来自')).toHaveCount(0);
    await expect(page.getByText(/^接口：/)).toHaveCount(0);
    await expect(page.getByText(/档位来自/)).toHaveCount(0);
    await expect(page.getByText('思维强度', { exact: true })).toBeVisible();
    await expect(page.getByLabel('设置提供商')).toContainText('DeepSeek');
    await expect(page.getByLabel('设置提供商')).toContainText('OpenCode Go');
    await expect(page.getByText('推理 支持')).toBeVisible();
    await expect(page.getByText('视觉 不支持')).toBeVisible();
    await expect(page.getByText('上下文 1M', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '浅色' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: '新增' }).click();
    await expect(page.getByLabel('设置提供商')).toContainText('自定义提供商');
    await page.getByLabel('名称').fill('本地 Ollama');
    await page.getByLabel('Base URL').fill('http://127.0.0.1:11434/v1');
    await page.getByLabel('API Key').fill('ollama');
    await page.getByLabel('模型列表（逗号分隔）').fill('llama3, qwen2.5');
    await expect(page.getByLabel('当前模型')).toContainText('llama3');
    await expect(page.getByText('该接口不接受思维强度参数，按服务端默认推理。')).toBeVisible();
    await page.locator('textarea.prompt').first().fill('你是测试助手。');
    await closeOverlay(page);
    await expect(page.getByText(/思维 默认推理/)).toBeVisible();
    await expect(page.locator('.model-title')).toContainText('llama3');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('catalog provider switch loads SHOW CONFIGURATION caps', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('设置提供商').selectOption('openai');
    await page.getByLabel('当前模型').selectOption('gpt-4o');
    await expect(page.getByText('推理 不支持')).toBeVisible();
    await expect(page.getByText('视觉 支持')).toBeVisible();
    await expect(page.getByText('当前模型不支持推理，已隐藏思维强度。')).toBeVisible();
    await closeOverlay(page);
    await expect(page.getByText(/无推理/)).toBeVisible();
    await expect(page.getByText(/视觉/)).toBeVisible();
    await page.getByRole('button', { name: '附件' }).click();
    await expect(page.getByRole('button', { name: /拍照/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /图片/ })).toBeVisible();
  });

  test('plugin center lists builtins and marketplace', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '插件中心' }).click();
    await expect(page.getByText('网页搜索')).toBeVisible();
    await expect(page.getByText('抓取网页')).toBeVisible();
    await expect(page.getByText('计算器')).toBeVisible();
    await expect(page.getByPlaceholder('搜索 dsh-plugin')).toBeVisible();
    await page.getByPlaceholder('搜索 dsh-plugin').fill('marketplace');
    await page.getByRole('button', { name: '搜索' }).click();
    await expect(page.locator('.plugin-card').first()).toBeVisible({ timeout: 20_000 });
  });

  test('mcp: add, edit, connect error, delete', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: 'MCP' }).click();
    await page.getByRole('button', { name: '添加 MCP 服务器' }).click();
    await expect(page.getByLabel('URL')).toHaveValue(/mcp/);
    await page.getByLabel('名称').fill('测试 MCP');
    await page.getByLabel('URL').fill('http://127.0.0.1:9/mcp');
    await page.getByRole('button', { name: '连接' }).click();
    await expect(page.getByText(/状态：error/)).toBeVisible({ timeout: 15_000 });
    await page.locator('.page .ghost-btn.danger').click();
    await expect(page.getByText('还没有 MCP')).toBeVisible();
  });

  test('thinking chain collapsed then opens bottom sheet', async ({ page }) => {
    await page.addInitScript(() => {
      const sessionId = 'ses_test';
      const state = {
        state: {
          providers: [
            {
              id: 'deepseek',
              name: 'DeepSeek',
              baseUrl: 'https://api.deepseek.com/v1',
              apiKey: '',
              models: ['deepseek-v4-flash'],
              kind: 'catalog',
            },
          ],
          activeProviderId: 'deepseek',
          activeModel: 'deepseek-v4-flash',
          thinkingEffort: 'high',
          systemPrompt: 'sys',
          themeMode: 'dark',
          mcpServers: [],
          installedPlugins: [],
          sessions: [
            {
              id: sessionId,
              title: '思维链样例',
              createdAt: 1,
              updatedAt: 2,
              archived: false,
              messages: [
                { id: 'u1', role: 'user', content: '1+1?', createdAt: 1 },
                {
                  id: 'a1',
                  role: 'assistant',
                  content: '等于 2。',
                  reasoning: '先分析算术，再给出答案。',
                  reasoningDurationMs: 3200,
                  createdAt: 2,
                },
              ],
            },
          ],
          activeSessionId: sessionId,
        },
        version: 0,
      };
      localStorage.setItem('dsh-agent-v1', JSON.stringify(state));
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /已思考 3s/ })).toBeVisible();
    await expect(page.getByText('先分析算术，再给出答案。')).toHaveCount(0);
    await page.getByRole('button', { name: /已思考 3s/ }).click();
    await expect(page.getByText('思维链', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('先分析算术，再给出答案。')).toBeVisible();
    await page.getByRole('button', { name: '完成' }).click();
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  test('streaming reasoning then answer with mocked DeepSeek SSE', async ({ page }) => {
    await reset(page);
    await openMenu(page);
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByLabel('API Key').fill('sk-test');
    await closeOverlay(page);

    await page.route(/\/chat\/completions$/, async (route) => {
      const sse = [
        'data: {"choices":[{"delta":{"reasoning_content":"逐步思考附件与问题。"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"实时回复已到达。"}}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n');
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: sse,
      });
    });

    await page.getByPlaceholder('发送消息').fill('测试流式输出');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByText('实时回复已到达。')).toBeVisible();
    await page.getByRole('button', { name: /已思考|思维链/ }).click();
    await expect(page.getByText('逐步思考附件与问题。')).toBeVisible();
  });

  test('text snippet attachment appears in composer', async ({ page }) => {
    await reset(page);
    await page.getByRole('button', { name: '附件' }).click();
    page.once('dialog', (d) => d.accept('hello from note'));
    await page.getByRole('button', { name: /文本片段/ }).click();
    await expect(page.locator('.att-chip')).toContainText('note.txt');
  });
});
