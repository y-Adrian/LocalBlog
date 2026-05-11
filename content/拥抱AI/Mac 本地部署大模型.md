# 1 Mac 本地部署大模型

> **环境信息**
> 
> - 硬件：Mac（Apple Silicon）/ 16 GB RAM
> - 系统：macOS 14+（Sonoma）
> - Ollama：最新版（≥ 0.6）
> - Python：3.11.x
> - Open WebUI：最新版（pip 安装）
> - 模型：`qwen3:14b`（通用对话）、`qwen2.5-coder:7b`（代码推理）


---

## 1.1 整体架构概览

整套本地 AI 系统分为五层，每层职责明确，可按需替换其中某个组件：

```
┌──────────────────────────────────────┐
│           UI 界面层                   │  ← Open WebUI
├──────────────────────────────────────┤
│           AI 调度层                   │  ← LiteLLM / MCP
├──────────────────────────────────────┤
│           大模型推理层                 │  ← qwen3:14b / qwen2.5-coder:7b
├──────────────────────────────────────┤
│           工具能力层                   │  ← 文件 / Shell / Git
├──────────────────────────────────────┤
│           长期记忆层                   │  ← RAG / 向量数据库
└──────────────────────────────────────┘
```

本教程重点覆盖 **Ollama 推理层** 和 **Open WebUI 界面层** 的安装与联通，是整个系统的基础骨架。

### 1.1.1 模型选型说明

|模型|用途|显存占用|推荐场景|
|---|---|---|---|
|`qwen3:14b`|通用对话 / 推理|约 10–12 GB|日常问答、分析、写作|
|`qwen2.5-coder:7b`|代码生成 / 补全|约 5–6 GB|编程辅助、代码审查|

> ⚠️ **注意**：16 GB 机型建议不要同时运行两个模型，防止内存溢出。可通过 `ollama ps` 查看当前占用，用 `ollama stop <模型名>` 释放内存。

---

## 1.2 安装 Ollama

Ollama 是大模型的本地运行引擎，负责模型下载、加载与推理加速（利用 Metal GPU）。

### 1.2.1 方式 A：官网下载（推荐）

1. 打开 https://ollama.com ，点击 **Download for macOS**，下载 `.dmg` 安装包。
2. 打开下载的 `.dmg` 文件，将 Ollama 拖入 Applications 文件夹。
3. 首次运行会请求权限，授权后菜单栏出现 Ollama 图标，代表服务已在后台运行。

### 1.2.2 方式 B：Homebrew 安装

```shell
# 使用 Homebrew 安装
brew install ollama

# 设置为开机自启（可选）
brew services start ollama
```

### 1.2.3 验证安装

```shell
# 查看版本号
ollama --version
# 预期输出示例：ollama version is 0.6.x
```

浏览器访问 http://localhost:11434 ，若页面显示 `Ollama is running` 则代表安装成功。

---

## 1.3 拉取模型到本地

Ollama 通过 `pull` 命令从官方仓库下载模型，类似 Docker 拉取镜像。模型文件默认存储在 `~/.ollama/models/`。按需拉取即可。

```shell
# 拉取通用对话模型（约 8.5 GB，需耐心等待）
ollama pull qwen3:14b

# 拉取代码专用模型（约 4.7 GB）
ollama pull qwen2.5-coder:7b

# 查看已下载的模型列表
ollama list
```

> 💡 下载过程中网络可能较慢，建议挂代理。下载完成后即使断网也可正常使用。

### 1.3.1 快速验证模型可用性

```shell
# 在终端直接与模型对话，Ctrl+D 退出
ollama run qwen3:14b
```

成功后终端出现 `>>>` 提示符，输入问题即可测试。

---

## 1.4 准备 Python 环境

Open WebUI 由 Python 编写，要求 **Python ≥ 3.11 且 < 3.13**。

### 1.4.1 检查现有版本

```shell
python3 --version
# 若输出 Python 3.11.x 或 3.12.x，跳过安装步骤
```

### 1.4.2 安装 Python 3.11（版本不符时）

```shell
# 使用 Homebrew 安装 Python 3.11
brew install python@3.11

# 验证安装
python3.11 --version
# 输出：Python 3.11.x
```

### 1.4.3 创建独立虚拟环境

强烈建议使用虚拟环境，避免污染系统 Python，也方便日后卸载。

```shell
# 创建专用工作目录
mkdir ~/openwebui
cd ~/openwebui

# 以 Python 3.11 创建虚拟环境
python3.11 -m venv venv

# 激活虚拟环境（每次打开新终端都需执行此步）
source venv/bin/activate

# 激活成功后，终端提示符前会出现 (venv) 字样
```

---

## 1.5 安装并启动 Open WebUI

Open WebUI 是功能完善的大模型前端界面，支持多模型切换、对话历史、文件上传等，与 Ollama 无缝集成。

### 1.5.1 安装

确认终端提示符已显示 `(venv)` 前缀后，执行安装命令：

```shell
# 安装 open-webui（首次约需 5–10 分钟）
pip install open-webui
```

### 1.5.2 启动服务

```shell
# 启动 Open WebUI
open-webui serve

# 若提示命令未找到，使用备选命令：
python -m open_webui serve
```

看到如下日志代表启动成功：

```
INFO:  Started server process [xxxxx]
INFO:  Waiting for application startup.
INFO:  Application startup complete.
INFO:  Uvicorn running on http://0.0.0.0:8080
```

打开浏览器，访问 **http://localhost:8080**，即可看到 Open WebUI 界面。

---

## 1.6 首次使用配置

首次打开需要创建管理员账号，该账号仅用于本地登录，信息可随意填写。

**步骤：**

1. 点击页面上的 **Get started**，进入注册页面。
    
2. 填写姓名、邮箱和密码（本地部署，信息不会上传任何服务器）：
    
    ```
    Name:     Your Name
    Email:    yourname@example.com
    Password: your_password
    ```
    
3. 点击创建，登录后在左上角模型下拉菜单中选择 `qwen3:14b` 或 `qwen2.5-coder:7b`，即可开始对话。
    

> 💡 若模型下拉菜单中没有出现已下载的模型，请检查 Ollama 服务是否正在运行，可执行 `ollama ps` 确认。

---

## 1.7 常用操作速查

### 1.7.1 Ollama 日常命令

```shell
# 查看已安装的模型
ollama list

# 查看当前运行中的模型及内存占用
ollama ps

# 停止某个模型（释放内存）
ollama stop qwen3:14b

# 删除模型（释放磁盘空间）
ollama rm qwen2.5-coder:7b

# 手动启动 Ollama 服务
ollama serve
```

### 1.7.2 每次重启后的完整启动流程

```shell
# 步骤 1：确认 Ollama 服务运行（通常开机自启，无需手动操作）
# 若未运行则执行：ollama serve

# 步骤 2：激活 Python 虚拟环境
cd ~/openwebui
source venv/bin/activate

# 步骤 3：启动 Open WebUI
open-webui serve

# 步骤 4：浏览器打开 http://localhost:8080
```

### 1.7.3 常见问题排查

|问题现象|可能原因|解决方法|
|---|---|---|
|模型列表为空|Ollama 服务未运行|执行 `ollama serve` 或重启菜单栏应用|
|`open-webui` 命令未找到|虚拟环境未激活|执行 `source venv/bin/activate`|
|对话响应极慢|内存不足，模型被 swap|关闭其他大型应用，或切换更小模型|
|8080 端口冲突|其他程序占用端口|执行 `open-webui serve --port 8081`|