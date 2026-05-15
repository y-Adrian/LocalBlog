---
tags:
  - Linux
---

# 1 Linux 存储与 I/O 子系统（基于 5.10 内核）

  
面向有嵌入式经验的同行：从系统调用到块设备驱动的纵向梳理，便于对照 5.10 源码阅读、实验与排障。文中路径与符号均以 **Linux 5.10** 树为参照；不同发行版配置与 backport 可能略有差异。

  
---


## 1.1 总览：一条主链与两条存储分叉

  

### 1.1.1 块设备主链（eMMC / SD / NVMe / SATA SSD 等）

  

进程通过系统调用进入内核 → **VFS**（`struct file` / `inode` / `dentry`）→ **具体文件系统**（如 ext4、f2fs）→ **页缓存**（`address_space`、radix tree）→ **通用块层**（`bio`、`blk-mq`、请求队列）→ **块设备驱动**（如 `mmcblk`、`nvme`）→ 带 FTL 的存储介质。

  

### 1.1.2 嵌入式常见分叉：MTD 路径

  

**SPI NOR / 裸 NAND** 等常走 **MTD + UBI + UBIFS**（或 JFFS2 等），语义与「块设备 + ext4」不同：擦写粒度、坏块、磨损均衡、卷管理在栈中位置都不一样。本文仍以块设备栈为主，在相关章节用简短对比提醒。

  

---

  

## 1.2 从进程到内核：系统调用入口

  

读写文件最常见的入口：

  

- `read(2)` / `write(2)` → `fs/read_write.c` 中 `vfs_read` / `vfs_write`。

- `pread` / `pwrite`：带偏移的包装，最终仍落到 VFS 层。

- `mmap(2)`：`mm/mmap.c` 与文件映射相关逻辑；文件页仍与 **页缓存** 强关联。

- `fsync(2)` / `fdatasync(2)`：将「文件」层面的持久化要求向下传递，具体保证取决于文件系统实现与设备写缓存策略。

- `open(2)` 标志 **`O_DIRECT`**：绕过页缓存的直访路径（有对齐等约束）。

  

**5.10 阅读建议**：在 `fs/read_write.c` 里跟一次 `vfs_read` → `file->f_op->read_iter`（新接口）或 `read`（老接口）的路径；`write` 同理看 `write_iter`。

  

---

  

## 1.3 VFS 层：路径如何变成 inode 与 file

  

### 1.3.1 核心对象（概念分工）

  

- **`struct file`**：进程一次「打开」的实例，含当前偏移、`f_op`、路径指向的 dentry/inode 等。

- **`struct dentry`**：路径分量缓存；negative dentry 与查找性能、行为有关。

- **`struct inode`**：文件在存储上的「逻辑元数据」（权限、大小、时间戳等）及具体文件系统的私有数据。

  

### 1.3.2 操作向量

  

- **`file_operations`**：open/read/write/mmap/poll/ioctl 等实例操作。

- **`inode_operations`**：lookup、create、unlink、 setattr 等 inode 级操作。

- **`address_space_operations`**：页缓存与后备存储之间的桥梁（读页、写页、写回等），是理解 **缓冲 I/O** 的关键。

  

**嵌入式启示**：很多「奇怪行为」来自 VFS 与具体 FS 的组合（例如某些 ioctl、O_TMPFILE、dnotify/inotify 与存储无关但干扰排障思路），先确认问题落在 VFS 还是 FS 还是块层。

  

---

  

## 1.4 页缓存与 address_space

  

### 1.4.1 是什么

  

**页缓存**将「文件数据」以页为单位缓存在内存中。每个 **inode** 关联一个 **`address_space`**（`include/linux/fs.h`），表示该文件在内存中的页集合及一套操作方法（`address_space_operations`）。

  

### 1.4.2 读路径直觉

  

- 缓冲读：先查页缓存是否已有对应页；缺页时通过 FS 注册的 `readpage` / `readahead` 等从块设备填充。

- **预读（readahead）**：顺序读时内核会提前拉取后续页，吞吐会明显好于随机小读。

  

### 1.4.3 写路径直觉

  

- 普通 `write`：常把数据拷入 **脏页（dirty page）**，标记为脏；真正刷盘由 **回写（writeback）** 机制异步完成（受 `vm.dirty_*` 等参数与负载影响）。

- **`fsync` / `fdatasync`**：强制把该文件相关数据/元数据（依调用）推到持久化语义边界（仍受下层设备缓存影响）。

  

### 1.4.4 与嵌入式相关的现象

  

- 只 `write` 不 `fsync`：掉电可能丢失「你以为已经写进去」的数据。

- 大量小随机写：脏页分散、元数据更新多，在 eMMC 上延迟与写放大往往比桌面 SSD 更难看。

- 内存压力：回收、回写、kworker 活动可能与实时任务抢占资源相关，需结合 cgroup 与业务设计。

  

### 1.4.5 可读的典型文件

  

- `mm/filemap.c`：页缓存查找、缺页、预读、`generic_file_read_iter` 等。

- `mm/page-writeback.c`：脏页限、回写触发（概念级精读即可）。

  

**诊断**：`/proc/meminfo`（Dirty、Writeback）、`/proc/vmstat`（`nr_dirty`、`nr_writeback` 等）。

  

---

  

## 1.5 回写与「全局刷盘」

  

### 1.5.1 回写

  

内核在后台把脏页写回块设备；策略与 **backing device**、dirty 比例、周期有关。不必背所有 sysctl，但要理解：**回写是异步的**，与进程 `write` 返回成功不同步。

  

### 1.5.2 `sync(2)`、`syncfs(2)`

  

- `sync`：倾向把整个系统的脏数据刷出（粗粒度，嵌入式上可能造成明显卡顿）。

- `syncfs`：针对单个文件系统实例。

  

**设计建议**：关键数据用 **`fsync`/`fdatasync` 明确边界**，而不是依赖 `sync`。

  

---

  

## 1.6 缓冲 I/O、O_DIRECT、mmap 的对比（同行速查）

  

### 1.6.1 缓冲 I/O（默认）

  

- 优点：内核统一缓存、预读、写合并友好。

- 缺点：双份数据拷贝（用户态 ↔ 页缓存）；一致性边界要靠自己用 `fsync` 等理清。

  

### 1.6.2 O_DIRECT

  

- 绕过页缓存，用户缓冲区与设备/FS 约束的对齐要求严格（具体因文件系统与块大小而异）。

- 适合自管缓存的数据库式负载或已验证缓存有害的场景；踩坑多，上线前要在目标 FS/存储上实测。

  

### 1.6.3 mmap

  

- `MAP_SHARED`：修改可见性与回写节奏与页缓存一致；与并发、信号量、文件截断交互要小心。

- 嵌入式里常见于大块共享、日志、多媒体管线；性能不一定魔法，要看缺页与 TLB 行为。

  

---

  

## 1.7 块层：bio、请求队列与 blk-mq（5.10 主线）

  

### 1.7.1 bio

  

**`struct bio`**（`include/linux/blk_types.h`）描述一次块 I/O：目标设备、方向、与一组 **bvec**（页、偏移、长度）的 scatter-gather 列表。它是通用块层向驱动表达工作的核心抽象之一。

  

### 1.7.2 从 FS 到驱动（简化）

  

文件系统通过块层提交 I/O → 形成 **`request`**（在 blk-mq 下与硬件队列 tag 等结合）→ 驱动 `queue_rq` 或等价入口取出执行。

  

### 1.7.3 blk-mq（multi-queue block layer）

  

5.10 时代 **NVMe** 与多队列设备已广泛采用 **blk-mq**：按硬件队列能力组织，减少单队列锁竞争，提高并发。eMMC/SD 等仍是块设备，同样走 blk-mq 框架，但设备本身随机写延迟与队列深度限制更明显，**调 scheduler 往往不如改业务写入模式**。

  

### 1.7.4 I/O 调度器（elevator）

  

块设备队列上可挂 **kyber、mq-deadline、none、bfq** 等（取决于配置）。对低速 eMMC，**mq-deadline** 等有时能改善尾延迟；需用基准与 `iostat` 验证，避免教条。

  

### 1.7.5 推荐阅读入口

  

- `block/blk-core.c`、`block/blk-mq.c`、`block/blk-mq-sched.c`

- `include/linux/blkdev.h`、`include/linux/blk_types.h`

  

** sysfs**：`/sys/block/<dev>/queue/` 下 `scheduler`、`nr_requests`、`max_sectors_kb`、`read_ahead_kb` 等（理解含义后再改）。

  

---

  

## 1.8 文件系统层（ext4 / f2fs 等）在栈中的位置

  

### 1.8.1 同行评估维度（比「哪个快」更重要）

  

- **掉电一致性**：日志模式、ordered/writeback（概念）、checkpoint 频率（log-structured 类如 f2fs）。

- **元数据写入频率**：小文件与频繁 `fsync` 对 eMMC 不友好。

- **挂载与修复时间**：启动约束、是否接受 `fsck`。

- **只读根、OTA、A/B 分区**：与 FS 特性、double-write 策略是否匹配。

  

### 1.8.2 源码阅读提示

  

- ext4：`fs/ext4/` 中从 `inode.c`、`file.c`、`readpage`/`writepages` 相关路径入手。

- f2fs：`fs/f2fs/` 关注 segment、GC、checkpoint 与块层交互。

  

---

  

## 1.9 MTD / UBI / UBIFS 与块设备栈的差异（提要）

  

- **UBIFS** 运行在 **UBI** 之上，UBI 管理擦除块、坏块与卷；**LEB/PEB** 与磨损均衡是日常设计词汇。

- 掉电、性能瓶颈、调试工具链与 `ext4-on-mmc` 不同；若你的产品是这条线，应单独建一张「MTD 栈」图，不要硬套块设备经验。

  

---

  

## 1.10 持久化与屏障：REQ_PREFLUSH、REQ_FUA、设备写缓存

  

### 1.10.1 分层理解「掉电后数据在哪」

  

- **应用层**：是否等待 `fsync`/`fdatasync`。

- **文件系统层**：事务提交点、journal 提交策略。

- **块设备层**：设备是否有易失写缓存；内核如何通过 **`REQ_PREFLUSH`**、**`REQ_FUA`** 等标志要求刷新或强制落盘（能力依设备与驱动而异）。

  

**同行要能回答**：「这条产品路径上，最后一次保证持久化的边界在哪里？」答不出来就容易在客户现场被「掉电损坏」反杀。

  

---

  

## 1.11 观测与排障工具（建议熟练度分级）

  

### 1.11.1 基础（应熟练使用）

  

- **`iostat -xz 1`**：`%util`、`await`、`avgqu-sz`、每秒读写量；判断瓶颈在设备还是 CPU/锁。

- **`vmstat 1`**：粗看内存与 I/O 等待。

- **`/proc/meminfo`、`/proc/vmstat`**：dirty、writeback、回收相关。

  

### 1.11.2 中级

  

- **`pidstat -d 1`**：按进程看 I/O。

- **`/sys/block/<dev>/queue/*`**：队列与调度器参数（改前记录 baseline）。

  

### 1.11.3 进阶

  

- **`blktrace` + `blkparse` / `btt`**：延迟分段。

- **BPF/bpftrace**（若环境允许）：5.10 已具备较好 BPF 基础，可跟踪块层与 VFS 延迟（需自行编写或采用现成脚本）。

  

### 1.11.4 嵌入式现场

  

若卡顿与 **`kworker`** 写回并发**：结合 `vmstat`、`/proc/vmstat` 中 dirty 相关计数与业务写入模式对齐分析；避免一上来大面积 sysctl「调优」而无假设。

  

---

  

## 1.12 与 Linux 5.10 对齐的源码阅读路线（按周拆解可参考）

  

### 1.12.1 第一周：系统调用到 VFS 读写

  

- `fs/read_write.c`：`vfs_read`、`vfs_write`、`do_iter_read`、`do_iter_write`。

- 选一个具体 FS（如 ext4），跟 `read_iter` / `write_iter` 如何接到 `generic_file_read_iter`、`generic_file_write_iter`。

  

### 1.12.2 第二周：页缓存与回写

  

- `mm/filemap.c`：`generic_file_read_iter`、预读、`grab_cache_page_write_begin` 等写路径相关函数。

- `mm/page-writeback.c`：dirty 背景比与回写触发（概念 + 关键函数名）。

  

### 1.12.3 第三周：块层 bio 与 blk-mq

  

- `block/bio.c`：`submit_bio` 链路。

- `block/blk-mq.c`：入队、`queue_rq`、完成回调；对照你平台上某个驱动的 `mmc`/`nvme` 请求处理。

  

### 1.12.4 第四周：持久化与工具验证

  

- 结合 `fsync` 与块层 flush 标志读相关 FS 文档与代码路径。

- 用 `iostat` + 压力程序验证队列深度、调度器改动的实际效果。

  

---

  

## 1.13 刻意练习清单（建议实操）

  

- **白板/文档**：画你产品上的完整存储链（含分区、FS、是否 overlay），标注掉电边界与 `fsync` 责任归属。

- **一致性实验**：写小程序循环 `write` 不 `fsync`，在虚拟机或受控环境强制断电，记录文件系统表现；再加 `fsync` 对比。

- **延迟分解**：压测时用 `iostat` 与 `pidstat` 对齐，区分「设备慢」与「进程/锁慢」。

- **sysfs 假设驱动**：选一个 `/sys/block/.../queue` 参数，写出前后假设、改值、用同一 workload 记录差异。

- **分叉对比**：若团队同时维护 MMC 与 MTD 产品，用同一维度表格对比掉电语义、磨损、挂载与调试工具。

  

---

  

## 1.14 延伸阅读与关键词

  

- **LWN.net**：检索 `blk-mq`、`writeback`、`ext4 journal`、`f2fs` 等主题的历史文章（对理解设计权衡很有帮助）。

- **内核自带文档**：`Documentation/block/`、`Documentation/filesystems/`（以 5.10 树内版本为准）。

- **关键搜索词**：`address_space_operations`、`writepages`、`wbc`（writeback control）、`submit_bio`、`blk_mq_tag_set`、`REQ_OP_WRITE`、`REQ_PREFLUSH`。

  

---

  

## 1.15 版本与免责声明

  

本文以 **Linux 5.10** 通用主线为参照；各厂商内核可能 backport 或裁剪子系统。生产变更（sysctl、调度器、挂载参数）请在目标硬件与负载下回归测试。