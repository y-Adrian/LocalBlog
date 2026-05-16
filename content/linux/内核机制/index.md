---
title: Linux 内核机制
description: 系统调用、内存、调度、存储 IO 与 cgroup
---

# Linux 内核机制

用户态与内核交界、内存与调度、存储栈等**机制向**笔记。

## 系统调用

- [[Linux 系统调用与接口层]]
- [[Linux系统调用：用户态陷入内核完整流程]]

## 内存与调度

- [[kmalloc 与 vmalloc]]
- [[如何通过虚拟地址查找物理地址]]
- [[深入了解上下文切换]]
- [[进程调度与绑核]]
- [[内核同步机制总览]]

## 网络

- [[Linux 内核网络栈与 DPDK 适用边界]]
- [[MMU 与 IOMMU 案例串联]]
- [[eBPF 与 bpftrace 入门]]
- [[PREEMPT_RT 与 cyclictest 入门]]
- [[小内存板 OOM 行为]]

## 资源与 IO

- [[cgroup 使用指南]]
- [[存储与IO子系统]]
