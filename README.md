# Jenkins Tools

交互式 Jenkins CLI 工具，支持分步配置参数、触发构建和查询构建状态。

## 安装

```bash
npm install
npm run build
npm link
```

## 使用

### 交互式向导（推荐）

```bash
jkt                    # 启动交互式向导
jkt run                # 同上
jkt run --job frontend-deploy  # 跳过任务选择步骤
```

向导流程：
1. **认证** — 首次使用引导配置，已配置则自动验证
2. **选择任务** — 从预配置列表选择或手动输入
3. **配置参数** — 自动合并 Jenkins 默认值 + 配置文件预设 + 历史记录
4. **提交执行** — 确认摘要后触发构建

### 快捷构建

```bash
jkt build frontend-deploy -p ENV=staging -p BRANCH=dev
```

### 查询状态

```bash
jkt status frontend-deploy         # 最近构建状态
jkt status frontend-deploy -n 42   # 指定构建号
jkt status frontend-deploy --log   # 查看构建日志
```

### 配置管理

```bash
jkt config init    # 初始化配置文件
jkt config test    # 测试 Jenkins 连接
jkt config list    # 列出配置信息
```

## 配置

复制 `.jenkinsrc.example.yml` 为 `.jenkinsrc.yml` 并修改：

```yaml
servers:
  default: production
  profiles:
    production:
      url: https://jenkins.example.com
      username: your-user
      token: your-api-token

jobs:
  frontend-deploy:
    server: production
    name: frontend/deploy-main
```

### 参数合并优先级

构建参数按以下优先级合并（后者覆盖前者）：

1. Jenkins 参数定义的默认值
2. `.jenkinsrc.yml` 中预设的参数值
3. `.jenkins-history.json` 中最近一次的参数值

## 开发

```bash
npm run dev      # 监听模式编译
npm run build    # 编译
npm start        # 运行
```
