# Jenkins Tools 配置指南

## 配置目录

所有配置存放在 `~/.jkt/`：

```
~/.jkt/
  .jenkinsrc.yml          # 服务器配置和任务预设
  .jenkins-history.json   # 构建历史和最近参数
```

## .jenkinsrc.yml 结构

```yaml
servers:
  default: production        # 当前活跃 Profile
  profiles:
    production:
      url: https://jenkins.example.com
      username: your-user
      token: your-api-token   # API Token（推荐）
    staging:
      url: https://staging.example.com
      username: your-user
      password: your-password # 密码认证（替代方式）

jobs:
  frontend-deploy:           # 短别名
    server: production       # 使用哪个服务器
    name: frontend/deploy-main  # Jenkins 任务全路径
    params:                  # 可选参数预设
      branch: main
      ENV: production

  backend-test:
    server: staging
    name: backend/run-tests
```

## 认证方式

### API Token（推荐）

1. 进入 Jenkins > 用户 > 配置
2. 添加新的 API Token
3. 将 token 复制到配置

```yaml
token: 11a2b3c4d5e6f7g8h9i0j
```

### 密码（替代方式）

适用于不支持 API Token 的服务器：

```yaml
password: your-actual-password
```

## 任务预设

为常用任务定义快捷方式：

```yaml
jobs:
  deploy-prod:
    server: production
    name: frontend/deploy-main
    params:
      branch: main
      ENV: prod
      timeout: 30
```

然后使用别名：

```bash
jkt build deploy-prod
```

## 参数合并顺序

构建时，参数按以下顺序合并（后者覆盖前者）：

1. **Jenkins 默认值** — 来自任务的参数定义
2. **配置预设** — 来自 `.jenkinsrc.yml` 的 jobs.<别名>.params
3. **最近使用** — 来自 `.jenkins-history.json`
4. **命令行参数** — 来自 `-p key=value` 参数

## 多服务器设置

在不同 Jenkins 实例间切换：

```bash
jkt config use staging    # 切换到 staging
jkt config use production # 切换回 production
```

或在配置中为每个任务指定服务器：

```yaml
jobs:
  test-job:
    server: staging
    name: tests/run
  prod-job:
    server: production
    name: deploy/release
```

## .jenkins-history.json 结构

由 jkt 自动管理，包含：

```json
{
  "meta": { "version": "0.2.3" },
  "jobs": {
    "frontend-deploy": {
      "lastParams": { "branch": "main", "ENV": "prod" }
    }
  },
  "buildRecords": [
    {
      "jobName": "frontend/deploy-main",
      "buildNumber": 42,
      "timestamp": "2026-07-09T15:30:00Z",
      "status": "SUCCESS",
      "user": "admin",
      "params": { "branch": "main" }
    }
  ]
}
```

## 首次设置

```bash
jkt config init
```

交互式提示：
1. Jenkins URL
2. 用户名
3. 认证方式（token/密码）
4. 凭据值
5. 测试连接

## 故障排除

### 连接失败

```bash
jkt config test
```

检查：
- URL 是否正确且可达
- 凭据是否有效
- 网络是否允许访问

### 403 禁止访问

jkt 自动处理 CSRF（crumb 头 + cookie jar）。如果仍然失败：
- 检查 Jenkins 是否需要额外的认证头
- 验证用户是否有任务触发权限

### 任务未找到

对嵌套任务使用全路径：

```bash
jkt build folder/subfolder/job-name
```

或在配置中定义别名。