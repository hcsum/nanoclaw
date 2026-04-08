---
name: web-access
description: Full web access with browser CDP, dynamic pages, and login state. The default tool for general purpose web browsing.
---

# web-access

## 前置说明

默认的联网操作 skill 处理，包括：搜索、网页抓取、登录后操作、网络交互等。

## 浏览哲学

像人一样思考，兼顾高效与适应性的完成任务。执行任务时不会过度依赖固有印象所规划的步骤，而是带着目标进入，边看边判断，遇到阻碍就解决，发现内容不够就深入——全程围绕「我要达成什么」做决策。

## 联网工具选择

| 场景                                                                           | 工具                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 搜索摘要或关键词结果，发现信息来源                                             | **WebSearch**                                                          |
| URL 已知，需要从页面定向提取特定信息                                           | **WebFetch**（拉取网页内容，由小模型根据 prompt 提取，返回处理后结果） |
| URL 已知，需要原始 HTML 源码（meta、JSON-LD 等结构化字段）                     | **curl**                                                               |
| 非公开内容，或已知静态层无效的平台（小红书、微信公众号等公开内容也被反爬限制） | **浏览器 CDP**（直接，跳过静态层）                                     |
| 需要登录态、交互操作，或需要像人一样在浏览器内自由导航探索                     | **浏览器 CDP**                                                         |

## 浏览器 CDP 模式使用方法

使用 `web_access_call` 工具调用 CDP Proxy API：

### 可用 API 端点

- `GET /targets` - 列出所有页面 tab
- `GET /new?url=xxx` - 创建新后台 tab（自动等待加载）
- `GET /close?target=ID` - 关闭 tab
- `GET /navigate?target=ID&url=URL` - 导航（自动等待加载）
- `GET /back?target=ID` - 后退
- `GET /info?target=ID` - 页面标题/URL/状态
- `POST /eval?target=ID` - 执行 JS（POST body 为 JS 表达式）
- `POST /click?target=ID` - 点击元素（POST body 为 CSS 选择器）
- `POST /clickAt?target=ID` - 真实鼠标点击（POST body 为 CSS 选择器）
- `POST /setFiles?target=ID` - 文件上传（POST body 为 JSON: {"selector":"input[type=file]","files":["/path/to/file.png"]}）
- `GET /scroll?target=ID&y=3000` 或 `direction=bottom` - 滚动页面
- `GET /screenshot?target=ID&file=/tmp/shot.png` - 截图

### 工具使用示例

`/eval` 的 body 必须是原始 JavaScript 表达式或 IIFE，不要额外包一层引号。

- 正确：`document.title`
- 正确：`document.body.innerText.slice(0, 2000)`
- 正确：`(() => document.body.innerText.slice(0, 2000))()`
- 错误：`"document.title"`
- 错误：`"document.body.innerText.slice(0, 2000)"`

如果 `/eval` 返回值恰好等于你传入的源码字符串，优先检查自己是不是误加了外层引号，而不是先怀疑站点或 CDP 故障。

```javascript
// 列出所有 tab
await mcp_nanoclaw_web_access_call({
  method: 'GET',
  endpoint: '/targets',
});

// 创建新 tab 并访问页面
const newTabResult = await mcp_nanoclaw_web_access_call({
  method: 'GET',
  endpoint: '/new',
  query: { url: 'https://example.com' },
});
const targetId = newTabResult.data.targetId;

// 执行 JS 获取页面内容
await mcp_nanoclaw_web_access_call({
  method: 'POST',
  endpoint: '/eval',
  query: { target: targetId },
  body: 'document.body.innerText',
});

// 点击元素
await mcp_nanoclaw_web_access_call({
  method: 'POST',
  endpoint: '/click',
  query: { target: targetId },
  body: 'button.submit',
});

// 关闭 tab
await mcp_nanoclaw_web_access_call({
  method: 'GET',
  endpoint: '/close',
  query: { target: targetId },
});
```

## 重要注意事项

1. **主组限制**：此工具仅限主组使用
2. **Tab 管理**：若无用户明确要求，不主动操作用户已有 tab，所有操作都在自己创建的后台 tab 中进行，保持对用户环境的最小侵入。完成任务后关闭自己创建的 tab，保持环境整洁。
3. **登录判断**：默认应假设 Web Access 连的是宿主机上的专用 Chromium 浏览器 profile，而不是用户正在日常使用的主浏览器。该 profile 可能已经单独登录过一些站点，也可能是空白的。打开页面后先尝试获取目标内容，只有当确认目标内容无法获取且判断登录能解决时，才告知用户登录。
4. **站点经验**：优先使用已知的站点模式，遇到问题时回退到通用模式。

## 宿主机集成约定

1. Web Access 优先连接宿主机显式配置的专用浏览器实例，而不是自动抢占用户的默认 Chrome。
2. 当前环境变量名为 `WEB_ACCESS_BROWSER_*`，可指向 Brave、Chromium、Edge、Chrome Canary 等 Chromium 浏览器。
3. 如果宿主机已配置自动拉起，首次调用 `web_access_call` 时可能会自动启动该专用浏览器。
