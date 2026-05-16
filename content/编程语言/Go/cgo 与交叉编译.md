---
tags:
  - Go
title: cgo 与交叉编译
description: 调用 C 库与 GOOS GOARCH 交叉构建
date: 2026/05/16
---

# cgo 与交叉编译

本文对应 [[成长路径/index|成长路径]] **Go 低优先级**：在 **云管、网关 agent** 中调用 **C 库** 或 **交叉编译** Linux ARM 二进制。

---

## 交叉编译（无 cgo）

```bash
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o agent .
```

**CGO_ENABLED=0** 时 Go 纯静态链接，部署简单，适合 **纯 Go** 项目。

---

## cgo 何时需要

- 调用现有 **C SDK**（硬件、加密、DPDK 封装等）。
- 文件顶部：

```go
/*
#cgo LDFLAGS: -lmylib
#include "mylib.h"
*/
import "C"
```

---

## 交叉编译 + cgo

需 **目标架构的 C 交叉工具链** 与 **sysroot**：

```bash
export CGO_ENABLED=1
export GOOS=linux
export GOARCH=arm64
export CC=aarch64-linux-gnu-gcc
go build -o agent .
```

与 [[linux/学习路径/应用交叉编译实战指南]] 工具链一致。

---

## 注意

- cgo 破坏 **纯 Go 交叉编译** 的简便性。
- 嵌入式 **固件** 极少用 Go；多用于 **Linux 用户态** 运维组件。

---

## 延伸阅读

- [[编程语言/Go/goroutine 与 channel 并发模型]]
- [[工程基础/CMake 与交叉编译入门]]
