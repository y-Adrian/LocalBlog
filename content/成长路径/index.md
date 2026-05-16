---
title: 成长路径
description: 基于本站博文梳理的知识储备与待补清单，便于查漏补缺
date: 2026/05/16
---

# 成长路径

面向 **嵌入式 Linux + 高性能网络（DPDK）+ 系统级 C++** 方向。  
**✅** = 本站已有对应笔记（可复习）；**⬜** = 建议后续学习并补文/实践。

> 说明：私人刷题记录不在站内展示；算法与面试题可在本地维护，不纳入下表。

---

## 如何使用

- 按 **模块** 自上而下扫一遍，用 Obsidian / 编辑器勾选已完成项。
- 每完成一项实践，建议在对应模块写一篇「复盘」或补链到已有目录（见文末「与站内目录对应」）。
- 优先级：**高** → **中** → **低**（同模块内已标注）。

---

## 一、方向定位（目标能力）

- [x] 能描述嵌入式 Linux 从 **上电到 shell** 的软件阶段（见 [[linux/概览/嵌入式Linux基础知识]]）
- [x] 能独立完成 **交叉编译** 并在目标板运行用户态程序
- [x] 能独立 bring-up 一块新板：**Bootloader + 内核 + DT + rootfs**（高）→ [[linux/学习路径/新板 Bring-up 检查清单]]
- [x] 能说明 **内核网络栈** 与 **DPDK 旁路** 的适用边界（高）→ [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]
- [x] 具备 **生产级排障** 流程：日志 → perf/ftrace → 反汇编（高）→ [[系统调试/排障 SOP：日志、perf 与反汇编]]

---

## 二、工程基础

### 2.1 已有（✅）

- [x] [[工程基础/Shell Makefile Git 命令行基础|Shell / Makefile / Git 命令行]]
- [x] [[工程基础/Git使用教程|Git 使用教程]]
- [x] [[工程基础/编程中非常关键、非常常用的数学技巧|编程常用数学技巧]]
- [x] [[工程基础/设计模式|设计模式]]

### 2.2 待补（⬜）

**优先级：中**

- [x] **CMake / Meson**：库工程、交叉编译 toolchain 文件 → [[工程基础/CMake 与交叉编译入门]]
- [x] **静态分析**：`clang-tidy`、`cppcheck`；内核侧了解 `sparse` / `coccinelle` → [[工程基础/静态分析入门]]
- [x] **CI 基础**：GitHub Actions 构建 + 制品（固件/镜像可选）→ [[工程基础/GitHub Actions 与嵌入式 CI 入门]]
- [x] **代码评审清单**：嵌入式常见坑（对齐、volatile 误用、中断上下文）→ [[工程基础/嵌入式代码评审清单]]

---

## 三、嵌入式 Linux · 体系与平台

### 3.1 已有（✅）

- [x] [[linux/概览/嵌入式Linux基础知识|嵌入式 Linux 知识地图]]
- [x] [[linux/学习路径/嵌入式体系结构入门|体系结构入门]]（学习路径 阶段 2）
- [x] [[linux/学习路径/应用交叉编译实战指南|应用交叉编译实战]]
- [x] [[linux/学习路径/Buildroot 与厂商 BSP 入门|Buildroot 与厂商 BSP]]
- [x] [[linux/学习路径/设备树实战指南|设备树实战]]
- [x] [[linux/学习路径/字符设备驱动入门|字符设备驱动入门]]
- [x] [[linux/学习路径/I2C 与 SPI 驱动选学|I2C / SPI 驱动选学]]
- [x] [[linux/学习路径/Yocto 与内核子系统深入|Yocto 与内核子系统]]
- [x] [[linux/平台与构建/嵌入式场景下的交叉编译|交叉编译概念长文]]

### 3.2 待补（⬜）

**优先级：高**

- [x] **U-Boot 实操**：环境变量、`bootcmd`、加载 kernel/dtb/initramfs → [[linux/学习路径/U-Boot 实操指南]]
- [x] **启动排障手册**：串口无输出 / kernel panic / rootfs 挂载失败 → [[linux/学习路径/启动排障手册]]
- [x] **最小可启动工程**：一份可复现的 Buildroot **或** Yocto 镜像 + 文档 → [[linux/学习路径/最小可启动工程指南]]
- [x] **设备树 + platform 驱动**：完整 repo（reg/interrupt/clock + probe）→ [[linux/驱动与模块/platform 驱动完整案例]]
- [x] **中断与下半部**：硬中断 / tasklet / workqueue 选用表 + 示例 → [[linux/学习路径/中断与下半部机制]]
- [x] **DMA 驱动基础**：`dma_map_*`、Cache 一致性、与 DT 配合 → [[linux/内核机制/DMA 与 Cache 一致性入门]]

**优先级：中**

- [x] **MMU / IOMMU**：与 [[linux/内核机制/如何通过虚拟地址查找物理地址]] 串联成案例 → [[linux/内核机制/MMU 与 IOMMU 案例串联]]
- [x] **TrustZone / 安全启动**：概念 + 与 BSP 责任边界（按项目）→ [[linux/平台与构建/TrustZone 与安全启动概念]]
- [x] **电源管理**：`runtime_pm`、休眠唤醒（按硬件）→ [[linux/驱动与模块/Runtime PM 与休眠唤醒入门]]

---

## 四、嵌入式 Linux · 文件系统与存储

### 4.1 已有（✅）

- [x] [[linux/内核机制/存储与IO子系统|存储与 IO 子系统]]（含栈边与 MTD/块设备概念）

### 4.2 待补（⬜）

**优先级：高**

- [x] **eMMC + ext4**：分区、`mkfs`、只读根文件系统、`fsck` 策略 → [[linux/文件系统/eMMC 与 ext4 根文件系统]]
- [x] **Raw NAND + UBI + UBIFS**：`ubiformat` / `ubinize`、掉电与升级注意点 → [[linux/文件系统/Raw NAND 与 UBI UBIFS 入门]]
- [x] **NAND 与 eMMC 选型对照**：一张表 + 板级实测结论 → [[linux/文件系统/NAND 与 eMMC 选型对照]]

**优先级：中**

- [x] **日志与持久化**：`journal`、barrier、`sync` 对嵌入式影响 → [[linux/文件系统/日志持久化与 barrier]]
- [x] **挂载参数与启动**：`rootwait`、`PARTUUID`、initramfs 场景 → [[linux/文件系统/挂载参数与启动场景]]

---

## 五、嵌入式 Linux · 内核机制

### 5.1 已有（✅）

- [x] [[linux/内核机制/Linux 系统调用与接口层|系统调用与接口层]]
- [x] [[linux/内核机制/Linux系统调用：用户态陷入内核完整流程|系统调用陷入流程]]
- [x] [[linux/内核机制/kmalloc 与 vmalloc|kmalloc 与 vmalloc]]
- [x] [[linux/内核机制/如何通过虚拟地址查找物理地址|虚拟地址查物理地址]]
- [x] [[linux/内核机制/深入了解上下文切换|上下文切换]]
- [x] [[linux/内核机制/cgroup 使用指南|cgroup 使用指南]]
- [x] [[linux/内核机制/存储与IO子系统|存储与 IO 子系统]]

### 5.2 待补（⬜）

**优先级：高**

- [x] **进程调度**：CFS、nice、`SCHED_FIFO`；与 DPDK 绑核 / `isolcpus` 对照 → [[linux/内核机制/进程调度与绑核]]
- [x] **内核同步总表**：spinlock / mutex / rwlock / RCU；`lockdep` 入门 → [[linux/内核机制/内核同步机制总览]]
- [x] **Linux 内核网络栈**：socket → 协议栈 → 驱动（与 DPDK 对比一篇）→ [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]

**优先级：中**

- [x] **PREEMPT_RT**：`cyclictest`、最坏延迟测量（选做）→ [[linux/内核机制/PREEMPT_RT 与 cyclictest 入门]]
- [x] **内存压测与 OOM**：小内存板上的行为记录 → [[linux/内核机制/小内存板 OOM 行为]]
- [x] **eBPF 入门**：`bpftrace` 跟踪延迟、丢包、栈 → [[linux/内核机制/eBPF 与 bpftrace 入门]]

---

## 六、嵌入式 Linux · 驱动与模块

### 6.1 已有（✅）

- [x] [[linux/驱动与模块/Linux 内核模块开发实战|内核模块开发实战]]
- [x] [[linux/学习路径/字符设备驱动入门|字符设备驱动入门]]
- [x] [[linux/学习路径/I2C 与 SPI 驱动选学|I2C / SPI 选学]]

### 6.2 待补（⬜）

**优先级：高**

- [x] **sysfs / proc 接口**：模块参数、调试节点 → [[linux/驱动与模块/sysfs 与 proc 调试接口]]
- [x] **platform 总线完整案例**：`compatible` 匹配 → `probe` → 资源释放 → [[linux/驱动与模块/platform 驱动完整案例]]
- [x] **块设备或网络驱动**：按目标硬件选一条线深入 → [[linux/驱动与模块/块设备与网络驱动选型指南]]

**优先级：低**

- [x] **Input / RTC / Watchdog** 等常见子系统驱动（按产品）→ [[linux/驱动与模块/Input RTC Watchdog 子系统速览]]

---

## 七、网络与 DPDK（数据面）

### 7.1 已有（✅）

- [x] [[网络与DPDK/教程/DPDK 教程 1：Hugepage、绑核、dpdk-devbind 与跑通 testpmd|教程 1：环境与 testpmd]]
- [x] [[网络与DPDK/教程/DPDK 教程 2：mbuf、mempool、ethdev 的数据路径|教程 2：mbuf / mempool / ethdev]]
- [x] [[网络与DPDK/教程/DPDK 教程 3：多队列 + RSS + 多 worker 的最小转发 or Echo|教程 3：多队列与多 worker]]
- [x] [[网络与DPDK/教程/DPDK 教程 4：Offload、Flow、NUMA、IOVA 与性能剖析|教程 4：Offload / NUMA / 性能]]
- [x] [[网络与DPDK/内存子系统/DPDK 内存与子系统|DPDK 内存与子系统]]

### 7.2 待补（⬜）

**优先级：高**

- [x] **最小数据面项目**：转发或 echo + 统计 + 配置（可写项目总结）→ [[网络与DPDK/实践/最小数据面项目设计]]
- [x] **多 worker 与 mempool 并发假设**：与 [[编程语言/C++/无锁编程]] 对照 → [[网络与DPDK/实践/多 worker 与 mempool 并发假设]]
- [x] **性能剖析闭环**：`perf` + 绑核 + 缓存行 / false sharing  checklist → [[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]

**优先级：中**

- [x] **AF_XDP**：何时用、与完整 DPDK 分工 → [[网络与DPDK/实践/AF_XDP 适用场景]]
- [x] **与内核共存**：路由、netfilter、管理口与数据口分离 → [[网络与DPDK/实践/与内核网络栈共存]]
- [x] **SR-IOV / VF**（云或虚拟化场景）→ [[网络与DPDK/实践/SR-IOV 与 VF 入门]]
- [x] **了解 VPP / OVS 定位**（不必深钻除非工作涉及）→ [[网络与DPDK/实践/VPP 与 OVS 定位速览]]

**优先级：低**

- [x] **RDMA**（特定行业）→ [[网络与DPDK/实践/RDMA 适用场景速览]]
- [x] **DPDK LTS 新特性**跟进笔记 → [[网络与DPDK/实践/DPDK LTS 版本跟进笔记]]

---

## 八、编程语言 · C++

### 8.1 已有（✅）

- [x] [[编程语言/C++/C++ 关键新特性|C++ 关键新特性]]（含 11 / 17 / 20 分篇）
- [x] [[编程语言/C++/RAII|RAII]]
- [x] [[编程语言/C++/STL 容器算法手册|STL 容器与算法]]
- [x] [[编程语言/C++/模版函数实例化的时机|模板函数实例化时机]]
- [x] [[编程语言/C++/模板元编程基础|模板元编程基础]]
- [x] [[编程语言/C++/C++多线程与多进程编程|多线程与多进程]]
- [x] [[编程语言/C++/内存模型|内存模型]]
- [x] [[编程语言/C++/无锁编程|无锁编程]]

### 8.2 待补（⬜）

**优先级：中**

- [x] **嵌入式 C++ 约束**：异常、`RTTI`、`-fno-exceptions`、静态链接体积 → [[编程语言/C++/嵌入式 C++ 编译约束]]
- [x] **C++ 封装 DPDK**：对象池、`rte_ring`、零拷贝接口设计 → [[编程语言/C++/C++ 封装 DPDK 数据面]]
- [x] **perf + 火焰图** 读 C++ 热点（可放在 [[系统调试/index|系统调试]]）→ [[系统调试/perf 与火焰图读 C++ 热点]]

**优先级：低**

- [x] **Rust 是否纳入主线**（仅当岗位或项目需要）→ [[编程语言/Rust/是否纳入嵌入式主线]]

---

## 九、编程语言 · Go

### 9.1 已有（✅）

- [x] [[编程语言/Go/Go语言基础|Go 语言基础]]

### 9.2 待补（⬜）

**优先级：低**

- [x] **goroutine / channel** 并发模型 → [[编程语言/Go/goroutine 与 channel 并发模型]]
- [x] **cgo 与交叉编译**（若做云管或工具链）→ [[编程语言/Go/cgo 与交叉编译]]

---

## 十、系统调试与排障

### 10.1 已有（✅）

- [x] [[系统调试/反汇编在嵌入式问题定位中的应用：环境、工具与可读性|反汇编定位]]
- [x] [[系统调试/线程池技术详解|线程池技术]]

### 10.2 待补（⬜）

**优先级：高**

- [x] **工具链一张图**：gdb、strace、`perf`、`ftrace`、`bpftrace`、`addr2line` → [[系统调试/排障工具链一张图]]
- [x] **排障 SOP**：先日志 → 再 perf → 再反汇编（一篇流程文）→ [[系统调试/排障 SOP：日志、perf 与反汇编]]
- [x] **内核卡死类**：soft lockup、RCU stall、hung task → [[系统调试/内核卡死与 hung task 入门]]

**优先级：中**

- [x] **用户态内存**：ASan / Valgrind（桌面验证算法）→ [[系统调试/ASan 与 Valgrind 桌面验证]]
- [x] **coredump** 分析基础 → [[系统调试/coredump 分析基础]]

---

## 十一、数据库

### 11.1 已有（✅）

- [x] [[数据库/PostgreSQL 中的物理复制与逻辑复制：机制、差异与选型|PostgreSQL 复制机制]]

### 11.2 待补（⬜）

**优先级：低**

- [x] **SQLite**：嵌入式配置库场景 → [[数据库/SQLite 嵌入式配置库]]
- [x] **时序库 / 边缘存储**（按产品选型）→ [[数据库/时序库与边缘存储选型]]

---

## 十二、OTA 与运维（嵌入式产品）

### 12.1 已有（✅）

- [x] [[linux/概览/嵌入式Linux基础知识]] 中 OTA / 可观测性概念

### 12.2 待补（⬜）

**优先级：高**

- [x] **A/B 分区** 与回滚策略 → [[linux/OTA/A-B 分区与回滚策略]]
- [x] **swupdate** 或 **Mender** 之一实操 → [[linux/OTA/swupdate 入门]]
- [x] **Mender** 实操（可选，与 swupdate 二选一深化）→ [[linux/OTA/Mender 入门]]
- [x] **远程日志与指标**：最小可观测方案（按产品）→ [[linux/OTA/远程日志与最小可观测]]

**优先级：中**

- [x] **许可证与 SBOM**：GPL 模块、第三方库合规扫描 → [[工程基础/许可证与 SBOM 入门]]

---

## 十三、AI 工具（效率向，非主线路）

### 13.1 已有（✅）

- [x] [[AI/如何撰写高效的 Prompt|高效 Prompt]]
- [x] [[AI/Mac 本地部署大模型|Mac 本地部署大模型]]

### 13.2 待补（⬜）

**优先级：低**

- [x] 用 AI 读 TRM / 内核 Documentation 的工作流 → [[AI/用 AI 读 TRM 与内核文档]]
- [x] 用 AI 生成测试用例 / 脚本草稿的规范（避免幻觉进生产）→ [[AI/用 AI 生成测试与脚本草稿]]

---

## 十四、推荐执行顺序（12 个月参考）

按季度勾选「阶段目标」即可，细节仍回到上文各模块清单。

### 第 1 季度 · 嵌入式闭环

- [x] U-Boot + 启动排障 → [[linux/学习路径/U-Boot 实操指南]]、[[linux/学习路径/启动排障手册]]
- [x] DT + platform 驱动完整工程 → [[linux/驱动与模块/platform 驱动完整案例]]
- [x] Buildroot **或** Yocto 可重复出镜像 → [[linux/学习路径/最小可启动工程指南]]
- [x] eMMC **或** UBI 文件系统实操 → [[linux/文件系统/index]]

### 第 2 季度 · 可观测与内核网络

- [x] perf / ftrace 入门 + 一次真实卡顿案例（模板）→ [[系统调试/perf 与 ftrace 实战案例模板]]
- [x] 内核网络栈 vs DPDK 对比文 → [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]
- [x] 排障 SOP 定稿 → [[系统调试/排障 SOP：日志、perf 与反汇编]]

### 第 3 季度 · 数据面项目化

- [x] DPDK 小项目（多 worker + 统计）→ [[网络与DPDK/实践/最小数据面项目设计]]
- [x] 性能剖析与绑核 checklist 实践 → [[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]

### 第 4 季度 · 产品化（二选一深入）

- [x] **OTA** 方案落地 **或** **AF_XDP** 专题 → [[linux/OTA/index]]、[[网络与DPDK/实践/AF_XDP 适用场景]]
- [x] 安全启动 / 合规（按工作需求）→ [[linux/平台与构建/安全启动与合规实践]]

---

## 十五、与站内目录对应（补文时放哪）

| 成长路径模块 | 建议写入目录 |
|--------------|--------------|
| 启动 / U-Boot / OTA | `linux/学习路径/` 或 `linux/平台与构建/` |
| 文件系统 / 存储 | `linux/文件系统/` |
| 驱动案例 | `linux/驱动与模块/` |
| 内核调度 / 网络栈 / eBPF | `linux/内核机制/` |
| DPDK 项目 / AF_XDP | `网络与DPDK/教程/` 或 [[网络与DPDK/实践/index]] |
| perf / 排障 SOP | `系统调试/` |
| C++ 与 DPDK 结合 | `编程语言/C++/` |
| 清单本身 | `成长路径/`（本页） |

---

## 十六、快速入口（复习用）

| 我想… | 从这里开始 |
|-------|------------|
| 总览地图 | [[linux/概览/嵌入式Linux基础知识]] |
| 按阶段教程 | [[linux/学习路径/index]] |
| DPDK 从零 | [[网络与DPDK/教程/index]] |
| C++ 并发底层 | [[编程语言/C++/内存模型]] → [[编程语言/C++/无锁编程]] |
| 命令行与构建 | [[工程基础/index]] |

---

*清单随博文更新而修订；完成实践后可将 ⬜ 改为 ✅ 并补上站内链接。*
