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
jkt build <任务>                            # 参数向导
jkt build <任务> -p branch=main             # 直接传参
jkt build <任务> -p branch=main -p ENV=prod # 多个参数
```

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
jkt config test                # 测试连接
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