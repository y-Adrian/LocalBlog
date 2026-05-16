---
tags:
  - Go
title: goroutine 与 channel 并发模型
description: CSP 风格并发与嵌入式工具链场景
date: 2026/05/16
---

# goroutine 与 channel 并发模型

本文对应 [[成长路径/index|成长路径]] **Go 低优先级**：理解 **goroutine / channel**，用于 **云管、CI 工具、网关侧车** 等，非嵌入式主线。

---

## goroutine

```go
go func() {
    // 轻量协程，由 Go runtime 调度
}()
```

**不要** 在无栈限制的 **裸机** 上跑 Go；交叉编译目标是 **Linux 用户态**。

---

## channel

```go
ch := make(chan int, 10) // 带缓冲
ch <- 1
v := <-ch
```

用于 **goroutine 间传递所有权**；`select` 多路复用。

---

## 与 C++/DPDK 分工

| 场景 | 语言 |
|------|------|
| 线速数据面 | C / C++ / DPDK |
| 配置 API、运维 agent | Go 常见 |
| 内核驱动 | C |

---

## 交叉编译

```bash
GOOS=linux GOARCH=arm64 go build -o app .
```

见成长路径 **cgo 与交叉编译**（若需调 C 库另文补充）。

---

## 延伸阅读

- [[编程语言/Go/Go语言基础]]
