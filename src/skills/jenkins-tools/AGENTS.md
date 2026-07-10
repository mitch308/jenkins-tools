# Jenkins Tools — Agent 指令

## 用途

此 skill 用于通过 `jkt` CLI 工具与 Jenkins CI/CD 服务器交互。
当用户需要触发构建、查询状态、中止任务或管理 Jenkins 配置时使用。

## 激活触发

当用户提及以下内容时激活此 skill：

- Jenkins、CI/CD、流水线、部署、构建
- 触发或运行任务/构建
- 查看构建状态、日志或进度
- 中止或停止 Jenkins 构建
- 配置 Jenkins 服务器或凭据
- 与 Jenkins 相关的"状态查询"

## 使用方式

### 触发构建

```bash
jkt build <任务名> -p key=value   # 直接传参构建
jkt params <任务名> --json         # 查询参数定义（默认读本地缓存）
```

### 查询状态

```bash
jkt status [任务名] [--log]
```

### 中止构建

```bash
jkt abort [任务名] [-n 构建号]
```

### 版本更新

```bash
jkt update             # 检查并更新
jkt update --check     # 仅检查
```

### 配置管理

```bash
jkt config init|add|use|test|list
```

## 前置条件

- 安装：`npm install -g jenkins-tools-cli`
- 验证：`jkt -v`
- 配置位置：`~/.jkt/`

## 完整参考

详见 `SKILL.md` 获取完整文档，包括工作流示例、决策流程和错误处理。