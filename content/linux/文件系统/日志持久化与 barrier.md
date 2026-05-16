---
tags:
  - Linux
  - 文件系统
title: 日志持久化与 barrier
description: journal、barrier 与 sync 对嵌入式存储的影响
date: 2026/05/16
---

# 日志持久化与 barrier

本文对应 [[成长路径/index|成长路径]] **中优先级**：在 eMMC/UBIFS 上配置 **日志** 与理解 **刷盘** 对寿命和性能的影响。

---

## 应用日志

| 方式 | 特点 |
|------|------|
| **syslog / journald** | 结构化、轮转 |
| **写文件** | 简单，需控制大小 |
| **tmpfs** | 掉电丢失，减 flash 磨损 |

嵌入式常：**/var/log** 放 **可写分区** 或 **tmpfs + 远程上报**。

---

## ext4 journal

- **data=ordered**（默认）：元数据 journal，数据先写再提交元数据。
- **barrier**：保证写入顺序，**掉电一致性** 更好，可能 **增延迟**。

挂载选项：

```text
noatime,nodiratime,barrier=1
```

只读根可避免 journal 磨损，见 [[linux/文件系统/eMMC 与 ext4 根文件系统]]。

---

## sync / fsync

```c
fsync(fd);   /* 该文件 */
sync();      /* 全局，重 */
```

高频 `fsync` 在 eMMC 上 **放大写放大**；批量提交或 **环形缓冲** 更合适。

---

## UBIFS

日志在 **UBI 卷** 内；注意 **sync** 触发 **垃圾回收** 峰值延迟。

---

## 延伸阅读

- [[linux/OTA/A-B 分区与回滚策略]] 远程日志
- [[linux/文件系统/Raw NAND 与 UBI UBIFS 入门]]
