---
description: 管理 Jenkins CLI 配置。当用户要求初始化配置、测试连接、查看配置信息时使用。
---

# 管理 Jenkins CLI 配置

使用 `jkt` CLI 工具管理 Jenkins 连接配置。

## 初始化配置

首次使用时配置 Jenkins 连接：

```bash
jkt config init
```

交互式引导输入：Jenkins URL、用户名、API Token 或密码。

## 测试连接

验证当前配置是否能连接到 Jenkins：

```bash
jkt config test
```

## 列出配置

查看已配置的服务器和任务：

```bash
jkt config list
```

## 配置文件

配置文件位于项目根目录 `.jenkinsrc.yml`：

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

## 注意事项

- 配置文件包含敏感信息，已在 `.gitignore` 中排除
- 支持 API Token 和用户名密码两种认证方式
- 可配置多个服务器 profile
