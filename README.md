# Prompt Playground

一个纯前端的 Prompt 工程调试沙盒。组合多轮消息、对接 DeepSeek 模型测试效果、观察工具调用决策、快速迭代——所有数据都在浏览器本地存储，无需后端。

## 功能

- **多轮消息编辑器** — 支持 system、human、AI、tool 四种角色，自由增删排序。
- **流式输出** — 对接 DeepSeek 实时流式返回，展示 token 用量。
- **工具调用观察** — 内置 18 个 mock 工具（AST 搜索、代码拉取、git、数据库等），支持自定义添加 mock 工具。给 prompt 绑定工具，单次调用，观察模型选择了哪些工具、传了什么参数——只观察不执行。
- **运行历史** — 每次运行自动命名、保存流式输出、工具调用轨迹和 token 统计。可浏览、重命名、回看。
- **反馈系统** — 支持星级评分、标签和评论，跟踪 prompt 质量迭代。
- **Rendered / Raw 双视图** — 一键切换：Rendered 展示整洁的文本和工具调用卡片，Raw 展示 LangChain 原生 AIMessage JSON。
- **分组管理** — 按 group 组织 prompt，每个 prompt 独立记忆 temperature 和 max_tokens 设置。
- **数据管理** — Cards 和 Raw 两种视图检视所有数据（groups、prompts、runs、settings），支持 `.jsonl` 导入导出。
- **纯前端、零后端** — 数据持久化到 localStorage（JSONL 格式），无需服务器、数据库和账号。API Key 仅存储在本机。

## 技术栈

| 层 | 技术 |
|---|---|
| UI | React 19 + Tailwind CSS 4 |
| LLM | LangChain JS（`@langchain/deepseek`） |
| 模型 | DeepSeek Chat API |
| 图标 | Lucide React |
| 构建 | Vite 8 |

## 快速开始

### 前置条件

- Node.js 18+
- [DeepSeek API Key](https://platform.deepseek.com/api_keys)

### 安装和运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:7991`，点击右上角齿轮图标设置 API Key，即可开始编写 prompt。

### 生产构建

```bash
npm run build
npm run preview
```

## 使用指南

### 基础对话

1. 编写 system 消息和 human 消息。
2. 点击 **Run**（或 `Ctrl+Enter`）。
3. 实时查看流式返回结果。
4. 用星级、标签、评论对输出打分。

### 测试工具调用

1. 点击 prompt 上的 **Tools** 按钮，打开左右分栏的工具面板。
2. 左侧勾选要绑定的工具（内置或自定义），右侧可添加/编辑自定义 mock 工具——填写名称、描述、参数 JSON schema 和默认 mock 输出。
3. 写一条可能触发工具调用的 prompt（如"找出所有和认证相关的函数"）。
4. 点击 **Run** — 模型做单次决策：直接回复，或调用一个或多个工具。
5. 在 **Rendered** 视图下查看文本输出 + 工具调用卡片（名称、参数）。
6. 切换到 **Raw** 视图查看 LangChain 原生响应的完整结构（含 `tool_calls`、`usage_metadata`、`response_metadata`）。

### 组织工作

- **Groups**（左侧栏）— 创建类似"代码审查"、"文档生成"、"实验"等文件夹。
- **Prompts** 放在 group 下，每个 prompt 是一组消息 + 参数覆盖。
- **Runs** 显示在 prompt 下方，每次执行记录包含输入消息、输出和元数据。

### 数据管理

- 点击工具栏 **Data** 打开数据管理器。
- 在 **Cards** 视图按卡片浏览，在 **Raw** 视图直接编辑 JSONL 文本。
- 导出单个实体为 `.jsonl` 文件，方便版本控制或分享。
- 导入 `.jsonl` 文件恢复或灌入数据。

## 配置项

在 **Settings**（齿轮图标）中配置：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| API Key | *（必填）* | DeepSeek API 密钥 |
| Base URL | `https://api.deepseek.com/v1` | API 地址（支持代理） |
| Model | `deepseek-chat` | 模型名称 |
| Temperature | `0` | 输出随机性（0 = 确定性输出） |
| Max Tokens | `2048` | 最大输出 token 数 |

每个 prompt 可在消息编辑器工具栏中单独覆盖 temperature 和 max_tokens。

## 内置工具

18 个 mock 工具用于测试模型的工具调用行为：

| 类别 | 工具 |
|---|---|
| 代码搜索 | `ast_search`、`search_snippets`、`find_implementations`、`get_symbol_definition` |
| 代码读取 | `get_file_content`、`get_parent_class_hierarchy`、`get_type_info` |
| 版本控制 | `git_log`、`git_diff`、`git_blame` |
| 环境信息 | `get_environment_variable`、`get_os_info` |
| 数据库 | `db_query`、`db_list_tables` |
| 网络 | `http_request`、`read_file_from_disk` |
| 依赖管理 | `list_package_dependencies`、`search_available_packages` |

每个工具都有描述和 JSON 参数 schema（和模型实际看到的完全一致）。执行结果是 **mock 的**（假数据），方便在没有真实工具后端的情况下迭代 prompt 设计。

除了内置工具，还可通过 Tools 面板右侧表单**自定义添加 mock 工具**，需提供工具名称、描述、参数 JSON schema 和默认 mock 输出（默认 `{"result":"ok"}`）。自定义工具数据持久化到本地存储，刷新不丢失。

## 项目结构

```
prompt-playground/
├── public/                # 静态资源
├── src/
│   ├── main.jsx           # 入口文件
│   ├── App.jsx            # 主应用：状态管理、流程编排
│   ├── Sidebar.jsx        # 左侧导航：Groups、Prompts、Runs
│   ├── MessageEditor.jsx  # 多轮消息编辑器
│   ├── RunPanel.jsx       # 运行输出展示（Rendered/Raw 双视图）
│   ├── SettingsModal.jsx  # API Key 和模型设置
│   ├── DataModal.jsx      # 数据管理器（卡片/原始、导入/导出）
│   ├── ToolsModal.jsx     # 工具管理面板（左右分栏：列表 + 自定义工具表单）
│   ├── store.js           # localStorage JSONL 读写层
│   ├── llm.js             # LangChain DeepSeek 集成
│   └── tools.js           # 内置 + 自定义 mock 工具定义
├── index.html
├── package.json
└── vite.config.js
```

数据流向：用户编辑 prompt → `App.jsx` 编排 → `llm.js` 调用 DeepSeek → 返回结果存入 `store.js` → UI 通过 `RunPanel.jsx` 渲染。所有持久化经 `store.js` 写入 localStorage（换行分隔的 JSON 格式）。

## 许可证

MIT
