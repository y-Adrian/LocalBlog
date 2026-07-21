---
tags:
  - 数据库
  - 嵌入式
title: SQLite 嵌入式配置库
description: 单文件数据库、WAL 模式、并发读、C API 与嵌入式实践要点
date: 2026/05/16
---

# SQLite 嵌入式配置库

SQLite 是世界上部署量最大的数据库——它不是服务器，而是一个**嵌入到程序里的库**，数据存在单个文件里。在嵌入式 Linux 设备上，它是存储**配置、拓扑、告警记录**等结构化数据的最佳选择之一。

---

## 1. 适用场景

| 场景 | SQLite 是否适合 |
|------|---------------|
| 存储设备配置（IP、端口、策略）| ✅ 最佳选择 |
| 本地告警/事件日志（有限条数）| ✅ 适合 |
| 嵌入式 HMI 状态数据 | ✅ 适合 |
| 多进程高并发写入 | ⚠️ 有限（WAL 模式改善，但不如 PostgreSQL）|
| 海量指标时序数据（每秒 1000+ 写）| ❌ 换用时序库 |
| 需要全文检索 | ⚠️ 支持但性能有限 |

**核心优势：**
- 零配置、零服务进程、单文件（备份就是 `cp`）
- 支持完整 SQL（JOIN、子查询、事务）
- C 语言库，交叉编译容易
- **ACID 保证**：断电安全（配合 WAL）

---

## 2. C API 基础

SQLite 的 C API 有几个核心对象：

```c
#include <sqlite3.h>

/* 核心对象 */
sqlite3 *db;          // 数据库连接
sqlite3_stmt *stmt;   // 预编译语句
```

### 2.1 打开/关闭数据库

```c
int rc = sqlite3_open("/data/config.db", &db);
if (rc != SQLITE_OK) {
    fprintf(stderr, "Cannot open database: %s\n", sqlite3_errmsg(db));
    sqlite3_close(db);
    return -1;
}

/* ... 使用 db ... */

sqlite3_close(db);
```

### 2.2 建表（带错误检查）

```c
const char *sql =
    "CREATE TABLE IF NOT EXISTS config ("
    "  key   TEXT PRIMARY KEY,"
    "  value TEXT NOT NULL,"
    "  updated_at INTEGER DEFAULT (strftime('%s','now'))"
    ");";

char *errmsg = NULL;
rc = sqlite3_exec(db, sql, NULL, NULL, &errmsg);
if (rc != SQLITE_OK) {
    fprintf(stderr, "SQL error: %s\n", errmsg);
    sqlite3_free(errmsg);
}
```

### 2.3 预编译语句（防 SQL 注入，性能更好）

```c
/* 写入 */
sqlite3_stmt *stmt;
sqlite3_prepare_v2(db,
    "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?);",
    -1, &stmt, NULL);

sqlite3_bind_text(stmt, 1, "db_host", -1, SQLITE_STATIC);
sqlite3_bind_text(stmt, 2, "192.168.1.10", -1, SQLITE_STATIC);

rc = sqlite3_step(stmt);
if (rc != SQLITE_DONE) {
    fprintf(stderr, "Write failed: %s\n", sqlite3_errmsg(db));
}
sqlite3_finalize(stmt);

/* 读取 */
sqlite3_prepare_v2(db,
    "SELECT value FROM config WHERE key = ?;",
    -1, &stmt, NULL);
sqlite3_bind_text(stmt, 1, "db_host", -1, SQLITE_STATIC);

if (sqlite3_step(stmt) == SQLITE_ROW) {
    const char *value = (const char *)sqlite3_column_text(stmt, 0);
    printf("db_host = %s\n", value);
}
sqlite3_finalize(stmt);
```

### 2.4 事务批量写（性能关键）

**SQLite 默认每条语句自动提交，批量写时极慢**（每次 fsync 一次）：

```c
/* 批量写：用事务包裹，100 条写只需一次 fsync */
sqlite3_exec(db, "BEGIN TRANSACTION;", NULL, NULL, NULL);

for (int i = 0; i < 100; i++) {
    sqlite3_prepare_v2(db,
        "INSERT INTO logs (ts, msg) VALUES (?, ?);",
        -1, &stmt, NULL);
    sqlite3_bind_int64(stmt, 1, time(NULL));
    sqlite3_bind_text(stmt, 2, log_msgs[i], -1, SQLITE_STATIC);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}

sqlite3_exec(db, "COMMIT;", NULL, NULL, NULL);
```

---

## 3. WAL 模式（嵌入式推荐）

默认的 **journal 模式**在写入时会锁住整个数据库，读者也被阻塞。**WAL（Write-Ahead Logging）** 模式改变了这一点：

```c
/* 开启 WAL 模式（持久化，重启后保留）*/
sqlite3_exec(db, "PRAGMA journal_mode=WAL;", NULL, NULL, NULL);
```

**WAL 模式的优势：**

| 特性 | Journal 模式 | WAL 模式 |
|------|-------------|---------|
| 并发读写 | 写时读者阻塞 | 读写**并发**（读不阻塞写） |
| 写性能 | 慢（每次 fsync journal）| 快（顺序写 WAL 文件）|
| 断电安全 | 是 | 是（WAL + checkpoint）|
| 适合场景 | 单进程读写 | 多进程读 + 偶尔写 |

**WAL 的注意点：**
- 生成两个额外文件（`.db-wal` 和 `.db-shm`），需要一起备份
- 定期 checkpoint，避免 WAL 文件过大：`PRAGMA wal_checkpoint(TRUNCATE);`

---

## 4. 嵌入式实践要点

### 4.1 存储位置

```bash
# 不能放 rootfs（只读分区）
# 应该放可写数据分区
/data/config.db     # 典型路径
/var/lib/app/db.db  # 或 FHS 标准路径
```

### 4.2 掉电安全

```c
/* 关键写操作后强制同步到存储 */
sqlite3_exec(db, "PRAGMA synchronous=FULL;", NULL, NULL, NULL);
/* 或折中：NORMAL（WAL 模式下通常足够）*/
sqlite3_exec(db, "PRAGMA synchronous=NORMAL;", NULL, NULL, NULL);
```

`synchronous=FULL`：最安全，每次写都 fsync，慢。  
`synchronous=NORMAL`：WAL 模式下安全，性能折中。  
`synchronous=OFF`：最快，掉电可能损坏。

### 4.3 数据库大小控制

嵌入式存储有限，要主动清理：

```sql
-- 只保留最近 1000 条告警
DELETE FROM alarms WHERE id NOT IN (
    SELECT id FROM alarms ORDER BY ts DESC LIMIT 1000
);

-- 回收空间（类似 VACUUM，WAL 模式下清理旧事务）
PRAGMA wal_checkpoint(TRUNCATE);
VACUUM;
```

### 4.4 C++ RAII 封装

```cpp
class ConfigDB {
public:
    explicit ConfigDB(const std::string &path) {
        if (sqlite3_open(path.c_str(), &db_) != SQLITE_OK)
            throw std::runtime_error(sqlite3_errmsg(db_));
        sqlite3_exec(db_, "PRAGMA journal_mode=WAL;", nullptr, nullptr, nullptr);
        sqlite3_exec(db_, "PRAGMA synchronous=NORMAL;", nullptr, nullptr, nullptr);
    }

    ~ConfigDB() {
        if (db_) sqlite3_close(db_);
    }

    // 禁止拷贝
    ConfigDB(const ConfigDB&) = delete;
    ConfigDB& operator=(const ConfigDB&) = delete;

    std::string get(const std::string &key, const std::string &default_val = "") {
        sqlite3_stmt *stmt;
        sqlite3_prepare_v2(db_,
            "SELECT value FROM config WHERE key = ?;", -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, key.c_str(), -1, SQLITE_STATIC);

        std::string result = default_val;
        if (sqlite3_step(stmt) == SQLITE_ROW)
            result = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));

        sqlite3_finalize(stmt);
        return result;
    }

    void set(const std::string &key, const std::string &value) {
        sqlite3_stmt *stmt;
        sqlite3_prepare_v2(db_,
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?);",
            -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, key.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, value.c_str(), -1, SQLITE_STATIC);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }

private:
    sqlite3 *db_ = nullptr;
};
```

---

## 5. 备份与恢复

```bash
# 简单备份（WAL 模式下需要包含 -wal 文件，或用 Online Backup API）
cp /data/config.db /backup/config.db.$(date +%Y%m%d)

# SQLite 在线备份（C API）
sqlite3_backup *backup = sqlite3_backup_init(dest_db, "main", src_db, "main");
sqlite3_backup_step(backup, -1);   // -1 = 复制所有页
sqlite3_backup_finish(backup);

# 命令行备份
sqlite3 /data/config.db ".backup /backup/config.db"
```

---

## 延伸阅读

- [[数据库/时序库与边缘存储选型]]（何时需要换用时序库）
- [[linux/文件系统/eMMC 与 ext4 根文件系统]]（存储分区规划）
- [[数据库/PostgreSQL 中的物理复制与逻辑复制：机制、差异与选型]]（服务端对比）
