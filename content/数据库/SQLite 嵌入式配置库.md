---
tags:
  - 数据库
  - 嵌入式
title: SQLite 嵌入式配置库
description: 单文件数据库、WAL 与并发读场景
date: 2026/05/16
---

# SQLite 嵌入式配置库

本文对应 [[成长路径/index|成长路径]] **数据库 · 低优先级**：用 **SQLite** 存 **配置、拓扑、告警记录** 等结构化数据。

---

## 适用场景

- 需要 **SQL 查询**、多表关系，但不想跑 **PostgreSQL** 级服务。
- 单进程或 **少量写**、多读的网关 / 工控 HMI。

---

## 基本用法

```c
sqlite3 *db;
sqlite3_open("/data/cfg.db", &db);
sqlite3_exec(db, "CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);", 0, 0, 0);
```

---

## 实践注意

| 项 | 建议 |
|----|------|
| 存储 | 放 **可写 data 分区**，非只读 root |
| WAL | `PRAGMA journal_mode=WAL` 改善并发读 |
| 掉电 | 关键写后 **`fsync`** 或事务批量 |
| 备份 | 定期复制 `.db` 文件 |

---

## 与 PostgreSQL 笔记关系

[[数据库/PostgreSQL 中的物理复制与逻辑复制：机制、差异与选型]] 面向服务端；SQLite 面向 **端侧**。

---

## 延伸阅读

- [[linux/文件系统/eMMC 与 ext4 根文件系统]]
