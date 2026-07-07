---
description: 触发 Jenkins 构建。当用户要求构建、部署、打包、触发 Jenkins 任务时使用。
---

# 触发 Jenkins 构建

使用 `jkt` CLI 工具触发 Jenkins 构建任务。

## 交互式向导（推荐）

当用户要求构建但没有指定具体参数时，启动交互式向导：

```bash
jkt
```

向导会引导完成：认证 → 选择任务 → 配置参数 → 确认执行。

## 指定任务构建

当用户指定了任务名称时：

```bash
jkt build <job-name>
```

不传 `-p` 参数时会进入参数配置向导。

## 直接传参构建

当用户明确给出了所有参数时：

```bash
jkt build <job-name> -p KEY1=VALUE1 -p KEY2=VALUE2
```

## 使用预设别名

如果用户使用了 `.jenkinsrc.yml` 中配置的别名：

```bash
jkt build frontend-deploy -p ENV=production
```

## 注意事项

- 首次使用需要通过 `jkt config init` 配置 Jenkins 连接
- 构建参数通过 `-p KEY=VALUE` 格式传递
- 构建完成后会输出构建号和 URL
