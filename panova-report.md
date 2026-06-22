# Selector — 指向元素，告诉 AI 要改什么

:::metric
3|核心交互方式
2|数据导出通道
0|数据离开浏览器
:::

## 谁在用

你是一个前端开发者，或者任何需要用 AI 助手改页面的人。

你遇到的问题是：对着 AI 描述"那个标题、右上角那个按钮"很费劲，截图+圈出来也麻烦。你想做的只是：点一下那个元素，告诉 AI "把这个改成XXX"，然后 AI 就去改了。

Selector 就是干这件事的。它运行在浏览器里，不依赖任何服务端，不收集任何数据。

---

## 跟着用户走一遍

### 第一步：装一次，以后不用管

你只需要做一件事：打开安装页，把页面上那个叫 **Selector** 的按钮拖进浏览器书签栏。

装完就结束了。书签里存的是一段 `javascript:` 开头的代码，包含了 `editor.css` 和 `editor.js` 的完整内容。所以哪怕离线也能用。

> **如果安装页打不开：** 本地跑一下项目，用任意静态服务器托管 `index.html` 就行。

---

### 第二步：在任意网页启动选择器

打开你想改的页面（localhost 本地开发、线上生产环境都可以），点击书签栏里的 **Selector** 书签。

页面上会出现一个深色小面板，右上角有个绿点，写着 **Selecting**。这说明选择器已经激活，现在你把鼠标移到页面上，就能看到元素被高亮了。

面板可以拖拽移动，也可以最小化收起。如果暂时不想让它拦截点击，按 `Space` 暂停，再按一次恢复。

---

### 第三步：选元素

选择器激活后，你有几种方式选元素：

| 操作 | 效果 |
|---|---|
| **单击** | 选中一个元素，之前选中的会被清空 |
| **Shift+单击** | 追加选中，不清空已有选择 |
| **拖拽** | 框选，鼠标划过的区域里所有可见元素会被批量选中 |
| **↑ / ↓** | 选中元素的父级 / 第一个子元素 |
| **← / →** | 选中元素的前一个 / 后一个兄弟元素 |

选中的元素会有高亮框，四角有动画小方块，左上角显示元素标签（比如 `#hero` 或 `<h1>`）。

:::callout
元素选择不是"点什么就是什么"。Selector 会智能解析，尽量选中"有意义的"元素——比如你点在一个 `<span>` 里的文字上，它可能会选中整个包含它的 `<button>` 或 `<div>`。这样可以避免你选到过于细碎的节点。
:::

---

### 第四步（可选）：给元素加指令

选中元素后，元素旁边会出现一个 ✎ 按钮，点它可以给这个元素加一句话指令，比如"把这个改成红色"、"这里加一个链接"。

这些指令会跟着元素一起导出，AI 收到后就知道你对每个元素分别要做什么。

不加也没关系，你可以在把 prompt 粘贴给 AI 之后再补充说明。

---

### 第五步：导出 Prompt

选好元素、写好指令（如果有的话），有两种方式把结果发出去：

**方式一：复制到剪贴板（默认始终可用）**

按 `⌘C`，或者点面板里的 **Copy Prompt** 按钮。

Prompt 内容是纯文本，结构大概是：

```
Page: /dashboard

1. .hero-title <h1>
   selector: body > main > section > h1
   text: "Welcome to the Dashboard"
   html: <h1 class="hero-title">Welcome to the Dashboard</h1>
   instruction: 把这个改成红色

2. .sidebar <nav>
   selector: body > aside > nav
   text: "Home Settings Profile"
   html: <nav class="sidebar">...
   instruction: 在 Settings 后面加一个 Analytics 链接
```

然后把剪贴板内容粘贴进 Claude Code / Cursor / Codex 就行了。

**方式二：直接发送到 Claude Code（需要本地服务器）**

如果你本地跑着 `server/index.js`，面板里会出现一个 **Send to Claude Code** 按钮。点它，prompt 会直接通过 HTTP 发到 `localhost:7734`，服务器把它写进一个文件，Claude Code 那边监听到文件变化就自动读取并处理。

:::tooltip
**本地服务器是怎么工作的：**

`server/index.js` 是一个很简单的 Node.js HTTP 服务器，只做两件事：
1. `GET /ping` — 书签端每 5 秒 ping 一次，检测服务器是否在线（决定要不要显示 Send 按钮）
2. `POST /send` — 接收书签端发来的 prompt，写入 `/tmp/selector-msg.txt`，同时打印到 stdout

Claude Code 侧通过 `TaskOutput` 读取 stdout，拿到 prompt 后就像用户直接发了一样去处理。
:::

---

### 快捷键一览

| 快捷键 | 作用 |
|---|---|
| `Click` | 选中元素 |
| `Shift + Click` | 追加选中 |
| 拖拽 | 框选多个元素 |
| `↑` / `↓` | 切换到父元素 / 第一个子元素 |
| `←` / `→` | 切换到前一个 / 后一个兄弟元素 |
| `⌘C` | 复制 Prompt |
| `⌘Z` | 撤销最后一次选择操作 |
| `Space` | 暂停 / 恢复选择（鼠标事件不再被拦截） |
| `Esc` | 清空当前选择（按一次）；如果已经清空，再按一次关闭选择器面板 |

---

## 关键概念

### 元素解析规则

Selector 并不是"你点什么就选什么"。它有一个 `resolveTarget()` 函数，会向上查找"有意义的"元素。

"有意义"的标准是：
- 元素有直接的文字内容，或者
- 元素里包含 `<img>`、`<button>`、`<a>`、`<input>` 等交互元素，或者
- 元素有多个子元素（说明它是一个容器）

:::tooltip
**技术细节：** `resolveTarget` 在 `editor.js` 第 94-103 行。它会跳过 `ai-editor-root` 命名空间下的所有元素（这些是 Selector 自己创建的 UI，不能选），也跳过不可见的元素（`display:none`、`visibility:hidden`、`opacity:0`，或者宽高都小于 2px 的元素）。
:::

### 书签注入机制

这是整个工具最关键的技术决策：**为什么用书签，而不是 Chrome 插件？**

因为书签不需要安装、不需要权限申请、不受 Chrome Web Store 审核限制，而且可以在任何浏览器里用（Safari、Firefox 都行）。

实现方式：`index.html` 加载时，会 `fetch` `assets/editor.css` 和 `assets/editor.js`，把内容拼成一段 `javascript:` URL，设置成书签的 `href`。用户点击书签时，这段 JS 就在当前页面上下文里执行了。

:::callout
这段 JS 是通过 `javascript:` URL 执行的，所以它能直接操作当前页面的 DOM。CSS 通过动态创建 `<style>` 元素注入，JS 直接执行。这个方式可以绕过大部分网站的 CSP 限制（因为 `javascript:` URL 被视为用户主动行为）。
:::

### React 组件信息提取

如果你选中的元素是 React 组件渲染出来的，Selector 还能告诉你这个元素对应哪个 React 组件、源码在哪个文件哪一行。

这是通过读取 React 的 `__reactFiber` 内部属性实现的（只有在开发模式下或者 React DevTools 打开时才有）。信息会包含在导出的 prompt 里，AI 拿到后可以直接定位到源码。

> **如果页面不是 React  rendered：** 这些字段不会出现，不影响正常使用。Vue、Svelte 等框架暂无类似支持。

---

## 外部依赖

Selector 本身**没有任何外部依赖**。

| 组件 | 依赖 |
|---|---|
| `index.html`（安装页） | 无，纯静态 |
| `assets/editor.js` | 无，纯原生 JS |
| `assets/editor.css` | 无 |
| `server/index.js` | 仅需 Node.js 内置模块（`http`、`fs`、`path`） |

`index.html` 里通过 CDN 加载了 Google Fonts 的 Inter 字体，但这是页面自身的样式需求，跟书签功能无关（书签注入的是 `editor.css` 的内容，不包含这个字体）。

---

## 整体架构

Selector 由三个独立部分组成，彼此之间通过浏览器当前页面的 DOM 和 localhost HTTP 通信，不需要共享代码。

:::mermaid
graph TD
  A["index.html<br/><small>安装页：生成书签 URL</small>"] -->|"fetch editor.css + editor.js"| B["javascript: URL<br/><small>存入书签</small>"]
  B -->|"用户点击书签"| C["editor.js 注入当前页面<br/><small>创建选择 UI</small>"]
  C -->|"⌘C"| D["剪贴板<br/><small>用户粘贴到 AI</small>"]
  C -->|"Send to Claude Code"| E["server/index.js<br/><small>localhost:7734</small>"]
  E -->|"写入 /tmp/selector-msg.txt<br/>+ stdout"| F["Claude Code<br/><small>读取并处理</small>"]
:::

> **三条路径都是本地的：** 书签 JS 在浏览器里执行，服务器跑在 `127.0.0.1`，没有任何数据发送到外部服务器。

---

## 附：术语对照表

| 术语 | 含义 |
|---|---|
| Bookmarklet | 书签工具，指存在书签里的一段可执行的 JS 代码 |
| `javascript:` URL | 一种特殊的 URL 协议，点击后会执行其中的 JS 代码 |
| Selector | 本产品的名字，指那个用来"点元素"的工具 |
| AI-ID | 每个被选中的元素会被分配一个内部 ID（`el-0`、`el-1`...），用来追踪 annotation 和 overlay |
| Marquee 选择 | 拖拽框选，来源于 Photoshop 的术语 |
| `resolveTarget` | 智能解析目标元素，避免选到过于细碎的 DOM 节点 |

