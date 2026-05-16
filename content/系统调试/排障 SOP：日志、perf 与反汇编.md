---
tags:
  - 调试
  - SOP
title: 排障 SOP：日志、perf 与反汇编
description: 先日志、再 perf、再反汇编的生产级排查流程
date: 2026/05/16
---

# 排障 SOP：日志、perf 与反汇编

本文对应 [[成长路径/index|成长路径]] **方向定位** 与 **系统调试** 高优先级项：固化 **日志 → perf → 反汇编** 顺序，避免一上来反汇编。

---

## 阶段 0：复现与边界

- 记录 **版本**（内核、rootfs git hash、配置）。
- **最小复现步骤** + **发生频率**。
- 区分 **必现 / 概率 / 负载相关**。

---

## 阶段 1：日志

| 来源 | 动作 |
|------|------|
| 串口 / dmesg | `dmesg -T`，保存完整 boot 日志 |
| 应用 | 提高 loglevel，相关模块 **dynamic debug** |
| 系统 | `journalctl -u myservice`（若用 systemd） |
| 网络 | `tcpdump`、驱动统计、`ethtool -S` |

**停止条件**：日志已能指向 **具体模块/函数/配置项** 且可验证假设。

若日志不足 → 阶段 2，而非直接反汇编。

---

## 阶段 2：perf / ftrace

| 症状 | 工具 |
|------|------|
| CPU 高 | `perf top` / `perf record -g` |
| 延迟尖刺 | `ftrace function_graph`、`trace-cmd` |
| 丢包 | 软中断、`/proc/net/softnet_stat`、DPDK `xstats` |
| 锁竞争 | `perf lock`、内核 `lockstat`（若开） |

保存 **perf.data** 与 **report 文本** 附在 issue 中。

工具选型见 [[系统调试/排障工具链一张图]]。

---

## 阶段 3：反汇编 / 源码

适用：

- panic **RIP/EPC** 无符号或需对照指令。
- **内存损坏**，怀疑越界、use-after-free。
- perf 指向 **无调试信息** 的库。

步骤：

1. 用 **addr2line** / **gdb** 符号化。
2. **objdump -d** 对照反汇编，见 [[系统调试/反汇编在嵌入式问题定位中的应用：环境、工具与可读性]]。
3. 结合 **源码** 与 **git bisect** 定位引入提交。

---

## 决策简图

```text
能稳定复现？
  ├─ 否 → 加日志 / 采样，扩大窗口
  └─ 是 → dmesg / 应用日志能定位？
           ├─ 是 → 打补丁验证
           └─ 否 → perf / ftrace
                    ├─ 热点/延迟明确 → 改代码
                    └─ 仍模糊 → gdb / 反汇编 / KASAN(桌面)
```

---

## 交付物模板

每次闭环建议存档：

1. 现象描述  
2. 环境版本  
3. 日志片段（标时间线）  
4. perf 结论（一两句 + 附图）  
5. 根因与修复 commit  
6. 回归测试项  

---

## 与嵌入式启动 / 数据面

- 启动失败：优先 [[linux/学习路径/启动排障手册]]，再 perf。
- DPDK：**绑核 checklist** 见 [[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]。

---

## 实践清单

- [ ] 用本 SOP 处理一次真实问题并填交付物模板
- [ ] 团队 wiki 链到本文作为默认流程

---

## 延伸阅读

- [[成长路径/index]]
- [[linux/内核机制/进程调度与绑核]]
