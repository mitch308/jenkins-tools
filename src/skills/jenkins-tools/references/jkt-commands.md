# jkt CLI 命令参考

## 全局选项

```bash
jkt -v              # 显示版本号
jkt -h              # 显示帮助
jkt --job <名称>    # 预选任务（跳过任务选择向导）
```

## 命令

### jkt（默认 — 交互式向导）

启动 4 步交互式向导：

```bash
jkt                    # 完整向导
jkt --job pc-dev       # 跳过任务选择
```

**向导步骤**：
1. **认证** — 验证凭据或引导首次设置
2. **选择任务** — 从预设中选择或搜索 Jenkins
3. **配置参数** — 配置构建参数（合并默认值/历史）
4. **执行** — 查看摘要并确认构建

### jkt build

直接触发构建：

```bash
jkt build <任务> -p branch=main             # 直接传参（推荐，agent 环境）
jkt build <任务> -p branch=main -p ENV=prod # 多个参数
jkt build <任务>                            # 进入参数向导（仅 TTY 环境）
```

**⚠️ agent 环境（非 TTY）下不要运行不带 `-p` 的 jkt build，会卡住。**
应先用 `jkt params <任务> --json` 查询参数定义，确认参数后用 `-p` 传参。

### jkt params

查询任务的参数定义（**默认读取本地缓存，agent 构建流程的核心命令**）：

```bash
jkt params <任务>              # 人类可读格式（默认读本地缓存）
jkt params <任务> --json       # JSON 格式（供 agent/程序解析，默认读本地缓存）
jkt params <任务> -s staging   # 指定服务器 Profile
jkt params <任务> --remote     # 从远程 Jenkins 获取最新参数定义（同时更新本地缓存）
jkt params <任务> --remote --json  # 远程获取 + JSON 格式
jkt params <任务> --sync       # 从远程同步参数（删除已移除的 key，新增 key 使用默认值）
```

**⚠️ 默认读取本地缓存**：`jkt params` 默认从本地缓存读取参数定义，速度快且可离线使用。首次使用（无缓存）时自动从远程获取。

**JSON 输出示例（本地缓存模式）**：

```json
{
  "name": "frontend-deploy",
  "buildable": true,
  "source": "local",
  "lastParams": {
    "branch": "main",
    "ENV": "prod"
  },
  "params": [
    {
      "name": "branch",
      "type": "String",
      "default": "main",
      "description": "Git 分支",
      "choices": null
    },
    {
      "name": "ENV",
      "type": "Choice",
      "default": "dev",
      "description": "部署环境",
      "choices": ["dev", "staging", "prod"]
    }
  ]
}
```

**JSON 输出字段说明**：
- `source` — 数据来源：`"local"`（本地缓存）或 `"remote"`（远程获取）
- `lastParams` — 上次使用的参数值（可直接用于构建，无需逐个确认默认值）
- `sync` — 同步信息（仅 `--sync` 模式）：`added`（新增的 key）、`removed`（删除的 key）

**agent 应按以下流程使用**：
1. 执行 `jkt params <任务> --json` 获取参数定义（默认读本地缓存，快速）
2. 如果有 `lastParams`，直接展示上次使用的参数值，询问用户是否修改
3. 如果用户确认不修改，直接用 `lastParams` 的值构建
4. 如果需要最新参数定义：`jkt params <任务> --remote --json`
5. 如果远程参数配置已变更：`jkt params <任务> --sync` 同步后重新查看
6. 用 `jkt build <任务> -p key=value` 传参构建

### jkt status

查询构建状态：

```bash
jkt status                     # 最近通过 jkt 触发的构建
jkt status <任务>               # 任务最新构建
jkt status <任务> -n 42         # 指定构建号
jkt status <任务> -r 10         # 最近 10 次构建
jkt status <任务> --log         # 控制台日志
jkt status <任务> --recent      # 最近构建模式
```

### jkt abort

中止或删除构建：

```bash
jkt abort                      # 交互式选择
jkt abort <任务>                # 任务最新构建
jkt abort <任务> -n 42          # 指定构建号
```

### jkt config

配置管理：

```bash
jkt config init                # 首次设置
jkt config add <profile>       # 添加服务器 Profile
jkt config use <profile>       # 切换默认服务器
jkt config remove <profile>    # 移除服务器 Profile
jkt config test                # 测试默认服务器连接
jkt config test <profile>      # 测试指定服务器连接
jkt config list                # 显示所有配置
```

## 参数类型

jkt 从 Jenkins config.xml 自动检测参数类型：

| 类型 | 交互行为 |
|------|----------|
| String | 文本输入 |
| Boolean | 确认（y/n） |
| Choice | 选择列表 |
| Multi-select | 复选框列表 |
| Password | 遮蔽输入 |

## 输出格式

### 构建触发输出

```
✓ 构建触发成功
  任务: frontend/deploy-main
  构建: #42
  URL: https://jenkins.example.com/job/frontend/job/deploy-main/42/
```

### 状态输出

```
任务: frontend/deploy-main
  #42  ⏳ 构建中  2026-07-09 15:30  用户: admin
  #41  ✔  2026-07-09 14:00  用户: admin  耗时: 5m
```

### 中止输出

```
✓ 构建 #42 已中止
  任务: frontend/deploy-main
```