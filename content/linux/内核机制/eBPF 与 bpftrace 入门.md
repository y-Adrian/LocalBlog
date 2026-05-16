---
tags:
  - Linux
  - eBPF
title: eBPF 与 bpftrace 入门
description: 跟踪延迟、丢包与内核栈的短时探测
date: 2026/05/16
---

# eBPF 与 bpftrace 入门

本文对应 [[成长路径/index|成长路径]] **中优先级**：用 **bpftrace** 做 **可脚本化** 的内核观测（需内核 `CONFIG_BPF` 等）。

---

## 前置

```bash
# 内核需启用 BPF、BTF（较新发行版 / 自建内核）
bpftrace -V
```

嵌入式板若内核过旧或裁剪过度，可能 **不可用** — 先在 **桌面/VM** 练习。

---

## 示例

**按进程统计 syscall 延迟：**

```bash
bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @start[tid] = nsecs; }
  tracepoint:raw_syscalls:sys_exit /@start[tid]/ {
    @us[comm] = hist((nsecs - @start[tid]) / 1000);
    delete(@start[tid]);
  }'
```

**TCP 重传（需相应 tracepoint/kprobe 可用）：**

```bash
bpftrace -e 'kprobe:tcp_retransmit_skb { @[comm] = count(); }'
```

---

## 与 perf / ftrace

| 工具 | 特点 |
|------|------|
| perf | 采样、火焰图 |
| ftrace | 内核内置跟踪 |
| bpftrace | 灵活脚本、适合 ad-hoc |

见 [[系统调试/排障工具链一张图]]。

---

## 注意

- 生产环境评估 **开销** 与 **安全**（非 root 限制）。
- 脚本上线前在测试机验证 **内核版本兼容性**。

---

## 延伸阅读

- [[系统调试/排障 SOP：日志、perf 与反汇编]]
