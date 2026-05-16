---
title: DPDK 实践
description: 项目化总结、性能 checklist 与并发模型
---

# DPDK 实践

教程见 [[网络与DPDK/教程/index]]；本目录放 **项目总结** 与 **性能实践**。

| 文档 | 说明 |
|------|------|
| [[最小数据面项目设计]] | echo/转发 + 统计 + 配置 |
| [[DPDK 性能剖析与绑核 checklist]] | perf、绑核、false sharing |
| [[多 worker 与 mempool 并发假设]] | 与无锁编程对照 |
| [[与内核网络栈共存]] | 管理口与数据口分离 |
| [[AF_XDP 适用场景]] | 与完整 DPDK 分工 |
| [[VPP 与 OVS 定位速览]] | 生态定位 |
| [[SR-IOV 与 VF 入门]] | 虚拟化 VF 直通 |
| [[RDMA 适用场景速览]] | 与以太网 DPDK 区分 |
| [[DPDK LTS 版本跟进笔记]] | LTS 迁移检查 |
