---
tags:
  - Linux
  - 文件系统
  - 存储
title: 日志持久化与 barrier
description: journal、barrier、fsync 与嵌入式 Flash 寿命/掉电一致性权衡
date: 2026/05/16
---

# 日志持久化与 barrier

嵌入式上「日志要落盘」和「Flash 要耐用、掉电要一致」经常打架。本文对应 [[成长路径/index|成长路径]] 中优先级：讲清 **应用日志落哪**、**ext4 journal / barrier**、**fsync 写放大**，以及 UBIFS 上的注意点。

根分区选型见 [[eMMC 与 ext4 根文件系统]]、[[Raw NAND 与 UBI UBIFS 入门]]。

---

## 1. 读完能带走什么

- 能为产品选：**tmpfs / 可写分区 / 远程上报** 的日志策略。  
- 理解 ext4 **data=ordered** 与 **barrier** 对掉电一致性与延迟的影响。  
- 知道高频 `fsync` 为何伤 eMMC，以及批量刷盘思路。  
- 能说出 UBIFS 上 `sync` 与 GC 延迟的关系。

---

## 2. 场景与问题

| 需求 | 冲突 |
|------|------|
| 掉电后要留现场日志 | 多写 Flash → 磨损、慢 |
| 要掉电文件系统不坏 | journal + barrier → 延迟↑ |
| 要实时写每条 log | `fsync` 每条 → 写放大 |

```mermaid
flowchart LR
  App[应用写日志] --> Buf[页缓存]
  Buf -->|fsync / 事务提交| Jour[journal / 介质]
  Jour --> Media[eMMC / NAND]
```

---

## 3. 应用日志放哪

| 方式 | 特点 | 适用 |
|------|------|------|
| **syslog / journald** | 结构化、轮转 | 有 systemd 的发行版 |
| **直接写文件** | 简单 | 需自己做大小与轮转 |
| **tmpfs** | 掉电丢失，减磨损 | 可远程捞日志的设备 |
| **远程上报** | 本地短缓冲 + 网络 | 见 [[linux/OTA/远程日志与最小可观测]] |

嵌入式常见组合：

- 根fs **只读** + `/var` 或独立 **data 分区** 可写；  
- 或 `/var/log` → **tmpfs**，关键事件走网络 / 环形缓冲落 data 分区。

---

## 4. ext4 journal 与 barrier

### 4.1 journal 模式（直觉）

- **data=ordered**（常见默认）：元数据走 journal；数据先写入介质，再提交元数据——降低「元数据指向垃圾数据」的风险。  
- **data=writeback**：更快，掉电窗口下更易出现旧数据内容。  
- **data=journal**：数据也进 journal，最慢、最稳，嵌入式少用。

### 4.2 barrier（写屏障）

**barrier** 要求存储按序把 journal 相关写真正落到非易失介质，避免控制器重排导致「journal 显示提交成功但数据还在易失缓存」。

```text
# 挂载示例（按产品裁剪）
noatime,nodiratime,barrier=1
```

| 开 barrier | 关 barrier（或等价弱序） |
|------------|---------------------------|
| 掉电一致性更好 | 延迟更低、吞吐更好 |
| eMMC 上可能明显增尾延迟 | 掉电风险升高 |

只读根可大幅减少 journal 磨损，见 [[eMMC 与 ext4 根文件系统]]、[[挂载参数与启动场景]]。

---

## 5. sync / fsync 与写放大

```c
fsync(fd);    /* 单文件相关数据+元数据尽量落盘 */
fdatasync(fd); /* 侧重数据，元数据更少 */
sync();       /* 全局，很重，避免热路径调用 */
```

在 eMMC 上，每次 `fsync` 可能触发：

1. 写数据  
2. 写 journal  
3. 等待 barrier / cache flush  

日志若 **每行 fsync**，寿命与性能双杀。更稳妥：

- 用户态环形缓冲，**批量** fsync（按时间或按 KB）；  
- 或写 tmpfs，由独立线程低频落盘；  
- 关键告警走独立「可靠通道」（条数少，可 fsync）。

---

## 6. UBIFS 要点

- 日志与主数据都在 **UBI 卷** 语义下；`sync` 可能触发 **垃圾回收（GC）**，出现延迟尖峰。  
- 掉电依赖 UBIFS 自身日志设计；仍要避免无意义的疯狂 sync。  
- 细节见 [[Raw NAND 与 UBI UBIFS 入门]]。

---

## 7. 选型速查

| 目标 | 倾向 |
|------|------|
| 现场捞崩溃现场 | data 分区 + 限速落盘；或 pstore/kmsg（另题） |
| 最小磨损 | tmpfs + 远程；只读根 |
| 强掉电一致 | barrier=1、合理 journal、控制 fsync 频率 |
| 最高吞吐日志 | 接受弱持久，或专用工业存储方案 |

---

## 8. 检查清单

- [ ] `/var/log` 是否在可预期的可写介质上（且有轮转）  
- [ ] 是否避免热路径全局 `sync()`  
- [ ] 量产挂载参数是否记录在版本说明里  
- [ ] 掉电测试：拔电 N 次后 fsck / 启动是否稳定  

---

## 9. 延伸阅读

- [[linux/文件系统/eMMC 与 ext4 根文件系统]]  
- [[linux/文件系统/挂载参数与启动场景]]  
- [[linux/OTA/远程日志与最小可观测]]  
- [[linux/OTA/A-B 分区与回滚策略]]
