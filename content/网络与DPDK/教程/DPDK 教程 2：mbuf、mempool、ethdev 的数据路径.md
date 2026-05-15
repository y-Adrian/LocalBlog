---
tags:
  - DPDK
---

# 1 DPDK 教程（二）：`mbuf`、`mempool`、`ethdev` 的数据路径

本文对应学习路径第二步：**把“包从网卡进来到被应用消费”的主链路读成一张图**。读完你应能口述：**描述符环 → PMD RX → mbuf 与 mempool → 用户处理 → TX burst → 描述符回收**，并知道关键结构体字段的语义与常见误用。

---

## 1.1 总览：一条 RX 主链（概念正确、细节随 PMD 变化）

以典型 **收包** 路径为例（简化）：

**NIC DMA 写入 mbuf 数据区 → 硬件更新 RX ring descriptor → PMD `rx_burst` 扫描/批量回收描述符 → 填充 `rte_mbuf` 元数据（pkt_len、RSS hash、ol_flags 等）→ 应用处理 → `rte_eth_tx_burst` 填充 TX ring → NIC DMA 读 mbuf 数据区 → PMD 回收 mbuf 回 pool（或延迟回收策略依实现）**

TX 路径上还有 **offload 分段/校验和** 等分支，本文先给主干。

---

## 1.2 第一部分：`rte_mempool`（对象池）

### 1.2.1 解决什么问题

- **热路径禁止频繁 malloc**：每包 `malloc/free` 会带来不可预测延迟与锁竞争。
- **为无锁/低锁优化提供对象粒度**： mbuf、小结构体、自定义对象都可用同一套池化框架。

### 1.2.2 核心原理

- **预分配**：创建 pool 时一次性分配 **固定大小对象** 的存储（以及元数据）。
- **两层结构（常见）**：
  - **全局空闲结构**（ring/stack 等 ops 实现）。
  - **per-lcore local cache**：热路径优先命中本核 cache，批量与全局层交换，降低争用。

### 1.2.3 你必须掌握的配置语义（正确性相关）

- **SP/SC vs MP/MC**：多生产者/多消费者标志必须与真实并发模型一致；否则是 **未定义行为**，不是“慢一点”。
- **elt_size / cache_size / private_data_size**：`private_data_size` 常用于 mbuf 的 **dynamic mbuf field** 或应用私有扩展（以版本 API 为准）。

### 1.2.4 典型 API（阅读源码的入口名）

- `rte_mempool_create()` / `rte_mempool_create_empty()` + `rte_mempool_populate_default()`
- `rte_mempool_get_bulk()` / `rte_mempool_put_bulk()`

### 1.2.5 源码阅读线索（upstream 主干）

- `lib/mempool/rte_mempool.c`
- `lib/mempool/rte_mempool_ring.c`（常见 ring 后端）
- `lib/eal/include/rte_mempool.h`

### 1.2.6 常见误区

- **把 mempool 当成通用堆**：不规则大小对象请走 **`rte_malloc`** 或自建 allocator；mempool 是 **固定大小** 高速池。
- **池太小导致 RX 丢包**：RX burst 取不到 mbuf 时只能丢或统计 `rx_nombuf`（具体统计项以 PMD/版本为准）。

---

## 1.3 第二部分：`rte_mbuf`（报文元数据 + 数据指针）

### 1.3.1 解决什么问题

- **把“DMA buffer + 报文元数据 + 链式分片”统一成一个可批量传递的对象**。
- **为硬件 offload 与软件解析提供统一承载**：长度、各层偏移、offload 标志、hash、时间戳等。

### 1.3.2 核心结构（概念字段，名字以头文件为准）

- **数据指针与长度**：`data_off`、`data_len`、`pkt_len`；链式 mbuf 用 `next` 串联。
- **IOVA**：`buf_iova`（或等价字段）用于填描述符；与 **IOVA 模式（PA/VA/DC）** 强相关（见教程四）。
- **元数据**：`port`、`ol_flags`、`packet_type`（版本演进）、RSS `hash` 等。
- **引用计数**：`refcnt`；`rte_pktmbuf_clone` / `attach` / `free` 错误会导致泄漏或 double free。

### 1.3.3 mbuf 与 mempool 的关系

- mbuf **对象本体**通常来自 **`rte_pktmbuf_pool_create()`** 创建的 **mempool of mbufs**。
- mbuf 指向的数据 buffer 可能：
  - **内嵌在 mbuf 对象布局中**（常见小 mbuf），或
  - **独立 buffer 区**（取决于 pool 配置与实现；以 `rte_mbuf.h` 与 mbuf pool 创建参数为准）。

### 1.3.4 典型 API

- `rte_pktmbuf_alloc()` / `rte_pktmbuf_free()`
- `rte_pktmbuf_adj()` / `rte_pktmbuf_trim()`（修改可写头部空间）
- `rte_pktmbuf_read()`（跨链读取）

### 1.3.5 源码阅读线索

- `lib/mbuf/rte_mbuf.c`
- `lib/eal/include/rte_mbuf_core.h` / `rte_mbuf.h`（随版本拆分）

### 1.3.6 常见工程问题（排障语言）

- **headroom 不足**：封装 VLAN/MPLS 时需要预留 `RTE_PKTMBUF_HEADROOM` 相关配置。
- **链过长**：大包分片导致处理成本上升；考虑 TSO/GRO 或重组策略。

---

## 1.4 第三部分：`rte_ethdev`（网卡抽象与队列）

### 1.4.1 解决什么问题

- **屏蔽厂商 PMD 差异**：用统一 API 配置端口、队列、RSS、offload、统计。

### 1.4.2 核心对象

- **port_id**：逻辑端口号（0..N-1）。
- **RX/TX queue**：每队列一对 **descriptor ring**；`rx_burst/tx_burst` 批量处理。

### 1.4.3 典型初始化序列（应用侧心智图）

- `rte_eal_init()`
- `rte_eth_dev_configure()`：端口级配置（队列数、RSS key、mtu 等）
- `rte_eth_rx_queue_setup()` / `rte_eth_tx_queue_setup()`：绑定 **mempool**、ring 长度、burst 相关阈值
- `rte_eth_dev_start()`
- 运行时：`rte_eth_rx_burst()` / `rte_eth_tx_burst()`

### 1.4.4 `rx_burst` 做了什么（抽象层）

- 从硬件/描述符环取出已完成项，**批量**产出 mbuf 指针数组给上层。
- 返回值为本次实际收到的 mbuf 个数（可能小于 `nb_pkts` 请求）。

### 1.4.5 `tx_burst` 做了什么（抽象层）

- 尝试把 mbuf 链挂到 TX ring；返回实际发送个数；**未发送成功的 mbuf 仍由调用者负责释放/重试**（常见新手泄漏点）。

### 1.4.6 源码阅读线索（抽象层与 PMD 交界）

- `lib/ethdev/rte_ethdev.c`（Ethdev 框架）
- 具体 NIC：`drivers/net/*/` 下对应 PMD 的 `*_rx.c` / `*_tx.c`（Intel/Mellanox 等）

### 1.4.7 与 mempool/mbuf 的耦合点

- **`rx_queue_setup`** 必须传入 **mbuf pool**：PMD 在 RX 上填充 mbuf 并设置 `port`、`hash` 等字段。
- **TX offload** 可能要求 mbuf 元数据满足特定 `ol_flags` 组合（否则硬件行为未定义或静默错误）。

---

## 1.5 第四部分：把三者串成“一张图”（建议你画在白板）

- **ethdev RX**：从 NIC 到 mbuf 指针数组。
- **mbuf**：指向可 DMA 的 buffer，并携带长度与 offload 元数据。
- **mempool**：mbuf 的分配/回收速度与无锁特性来源。

---

## 1.6 推荐阅读顺序（源码）

- `rte_ethdev.h`：配置与 burst API。
- `rte_mbuf.h`：字段语义。
- `rte_mempool.h`：cache 与 ops。
- 任选一个你使用的 PMD：`xxx_recv_pkts` / `xxx_xmit_pkts` 对照 `rx_burst/tx_burst`。

---

## 1.7 自测题（能答上来即掌握第二步）

- **为什么 TX burst 返回小于请求时不能丢 mbuf？**
- **`rx_nombuf`（或等价统计）上升意味着什么？**
- **chained mbuf 下 `pkt_len` 与 `data_len` 的关系是什么？**

---

## 1.8 参考文档

- DPDK Programmer’s Guide：**Mbuf Library**、**Mempool Library**、**Poll Mode Driver**、**Ethernet Device**。

---

*不同 PMD 对 offload、RSS、descriptor 格式支持不同；性能数字必须以你硬件与 DPDK 版本实测为准。*
