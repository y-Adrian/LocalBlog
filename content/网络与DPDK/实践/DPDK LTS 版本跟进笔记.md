---
tags:
  - DPDK
title: DPDK LTS 版本跟进笔记
description: 如何跟踪 LTS 发布与迁移注意点
date: 2026/05/16
---

# DPDK LTS 版本跟进笔记

本文对应 [[成长路径/index|成长路径]] **低优先级**：建立 **DPDK LTS** 跟进习惯，避免生产长期停在无维护版本。

---

## LTS 是什么

- **dpdk.org** 发布 **长期支持** 分支，修复 bug 与安全项。
- 非 LTS 版本适合尝鲜新特性，**产品** 建议钉 LTS。

---

## 建议跟进节奏

| 频率 | 动作 |
|------|------|
| 每季度 | 浏览 **Release Notes** / **SECURITY** 邮件列表 |
| 升级前 | 读 **API 变更**、废弃 `rte_*` |
| 升级后 | 跑 **testpmd** + 业务回归 PPS/延迟 |

---

## 迁移检查清单

- [ ] `meson`/构建选项变化
- [ ] PMD 是否仍支持目标网卡
- [ ] `rte_ethdev`、`rte_flow` API 行为差异
- [ ] 默认 **hugepage** / **IOVA** 模式说明

---

## 与本站教程

教程基于某一 LTS 编写；升级时以 **官方 doc** 为准，本站文章作 **概念锚点**。

---

## 延伸阅读

- [[网络与DPDK/教程/index]]
