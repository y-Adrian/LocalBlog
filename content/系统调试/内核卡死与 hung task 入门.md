---
tags:
  - Linux
  - 内核
  - 排障
title: 内核卡死与 hung task 入门
description: soft lockup、RCU stall、hung task 现象与日志解读
date: 2026/05/16
---

# 内核卡死与 hung task 入门

本文对应 [[成长路径/index|成长路径]] **高优先级**：识别 **soft lockup、RCU stall、hung task** 等日志，并给出 **初步定位方向**。

---

## 三类常见「卡死」

| 类型 | 典型日志 | 含义 |
|------|----------|------|
| **soft lockup** | `BUG: soft lockup - CPU#2 stuck for 22s!` | 某核长时间关中断或死循环 |
| **hard lockup** | `NMI watchdog: Watchdog detected hard LOCKUP` | 核完全无响应（更严） |
| **RCU stall** | `rcu_sched detected stalls` | RCU 宽限期未完成 |
| **hung task** | `task xxx blocked for more than 120 seconds` | 进程 D 状态过久 |

---

## soft lockup

常见原因：

- 驱动 **硬中断 / spinlock** 临界区过长。
- **关中断** 后 `mdelay`、大循环。
- **实时线程** 占满 CPU。

排查：

- 日志中的 **栈** 指向函数。
- `echo 1 > /proc/sys/kernel/hung_task_panic`（仅调试）触发 crash 留 vmcore。
- **ftrace** `function_graph` 看卡点。

---

## RCU stall

常见原因：

- 某 CPU **长时间禁抢占** 未调度。
- **关 IRQ** 路径未 `rcu_read_unlock` 配对（驱动 bug）。
- 极端负载下 **RCU 回调** 堆积。

关注 **which CPU**、**blocked tasks** 列表。

---

## hung task

内核 **hung_task detector** 检测 **不可中断睡眠** 过久：

```text
echo 120 > /proc/sys/kernel/hung_task_timeout_secs
```

常见：**等锁**、**等 I/O**、**驱动 remove 死锁**。

对照 **/proc/<pid>/stack**（若仍可访问）或 **sysrq-t** 任务栈。

---

## 应急手段（开发板）

| 按键/命令 | 作用 |
|-----------|------|
| **SysRq** `t` | 打印所有任务栈 |
| **SysRq** `w` | 阻塞任务 |
| **SysRq** `g` | 触发 crash 留 dump（需配置） |
| 串口 **Magic SysRq** | `echo t > /proc/sysrq-trigger` |

---

## 与 watchdog 关系

硬件 **watchdog** 在 **系统无响应** 时复位；日志可能来不及完整输出，需 **early printk** 或 **pstore**。

---

## 实践清单

- [ ] 在 QEMU 用 **buggy 驱动** 触发一次 soft lockup（实验环境）
- [ ] 保存一份含 **全部任务栈** 的 sysrq-t 日志作模板

---

## 延伸阅读

- [[linux/学习路径/中断与下半部机制]]
- [[linux/内核机制/内核同步机制总览]]
- [[系统调试/排障 SOP：日志、perf 与反汇编]]
