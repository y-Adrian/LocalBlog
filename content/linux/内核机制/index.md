---
date: 2026/05/15
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
- [[Linux 内核调度机制面试详解]] — **CFS / 实时类 / 面试题**
- [[进程调度与绑核]] — vruntime、反转、绑核与 DPDK
- [[传统 IPC：System V 与 POSIX]]
- [[内核同步机制总览]]
- [[RCU 读拷贝更新机制详解]]
- [[per-CPU 与 per-core 数据结构]]
- [[为什么 ISR 不能睡眠]]
- [[Linux 中断机制详解]]

## 数据结构与时间管理

- [[内核链表与常用数据结构]] — list_head、container_of、rbtree、IDR
- [[内核定时器与时间管理]] — jiffies/HZ、hrtimer、delayed_work

## 设备驱动子系统

- [[设备树内核 API（OF API）]] — of_property_read_*、GPIO/IRQ/Clock 获取
- [[GPIO 与 gpiod 子系统]] — gpiod descriptor API、GPIO 中断
- [[Clock 与 Pinctrl 子系统]] — 时钟树/CCF、引脚复用
- [[DMA 与 Cache 一致性入门]] — 一致性/流式映射、Cache 一致性

## 调试与日志

- [[内核日志与 printk 机制]] — 日志级别、环形缓冲、console_loglevel、限速
- [[eBPF 与 bpftrace 入门]] — 结构化观测

## 网络

- [[Linux 内核网络栈与 DPDK 适用边界]]
- [[MMU 与 IOMMU 案例串联]]
- [[PREEMPT_RT 与 cyclictest 入门]]
- [[小内存板 OOM 行为]]

## 资源与 IO

- [[cgroup 使用指南]]
- [[存储与IO子系统]]
