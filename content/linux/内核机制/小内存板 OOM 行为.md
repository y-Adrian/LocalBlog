---
tags:
  - Linux
  - 内存
title: 小内存板 OOM 行为
description: 内存压测、OOM killer 与 cgroup 限制
date: 2026/05/16
---

# 小内存板 OOM 行为

本文对应 [[成长路径/index|成长路径]] **选做**：记录 **小 RAM** 设备上 OOM 与 **cgroup** 限制表现。

---

## 观察 OOM

```bash
dmesg | grep -i "out of memory"
grep -i oom /var/log/*
```

日志含 **被杀进程**、**oom_score**、**Call Trace**。

---

## 压测（谨慎）

```bash
stress-ng --vm 1 --vm-bytes 80% --timeout 60s
```

在 **开发板** 上执行，避免损坏文件系统；提前 **sync**。

---

## 缓解

| 手段 | 说明 |
|------|------|
| **cgroup memory.limit** | 限制服务，见 [[linux/内核机制/cgroup 使用指南]] |
| 减少 buffer | 网络、DPDK mempool 尺寸 |
| zram | 用压缩 swap（权衡 CPU） |

---

## 记录模板

| 总 RAM | 触发 OOM 场景 | 被杀进程 | 措施 |
|--------|---------------|----------|------|
| 256MiB | 并发 xxx | app | 限 cgroup |

---

## 延伸阅读

- [[linux/内核机制/kmalloc 与 vmalloc]]
