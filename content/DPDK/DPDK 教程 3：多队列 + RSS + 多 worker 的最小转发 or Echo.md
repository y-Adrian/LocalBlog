# 1 DPDK 教程（三）：多队列 + RSS + 多 worker 的最小转发 / Echo

本文对应学习路径第三步：在理解 **ethdev/mbuf/mempool** 后，做一个**最小可运行**的转发或 echo 原型，刻意使用 **多 RX 队列 + RSS** 把流量分散到 **多个 worker lcore**。目标是建立 **“队列—核—数据面线程模型”** 的设计直觉，而不是追求功能最全的 L3 转发器。

---

## 1.1 本文目标与验收标准

- **目标**：同一端口（或双端口）上启用 **>=2 个 RX 队列**，配置 **RSS** 使多流分散到不同队列；每个队列绑定一个 **worker lcore** 做最小处理（echo 或 L2 环回/交换）。
- **验收**：用 `pktgen-dpdk` 或双口环回产生**多流**（不同五元组）时，`rte_eth_stats` 或 `testpmd`/`fwd` 统计显示 **各队列均有收包**；CPU 利用率在多核上呈扩展趋势（受限于 PCIe/NIC/内存带宽时除外）。

---

## 1.2 设计选择：先 `testpmd` 原型，再落到最小 C 程序

### 1.2.1 为什么分两步

- **`testpmd`** 能快速验证 **RSS hash、队列数、reta（ redirection table ）** 与 PMD 能力矩阵，减少“自写程序配置错”的变量。
- **最小 C 程序**强迫你补齐 **EAL init、port configure、queue setup、lcore launch** 全链路。

---

## 1.3 第一部分：RSS 与多队列在解决什么问题

### 1.3.1 场景

- 单队列 + 单核收包容易 **CPU 单线程瓶颈**；NIC 已具备多队列 DMA 能力。

### 1.3.2 RSS（Receive Side Scaling）在做什么

- NIC 对报文计算 **hash**（常见输入为四元组/五元组，具体算法与字段由硬件与配置决定）。
- 用 hash 结果查 **RETA（redirection table）** 选择 **RX queue index**。
- 目标：让**不同流**落到**不同队列**，从而被**不同 worker** 并行处理。

### 1.3.3 你必须接受的限制（严谨）

- **单流**无法被 RSS “拆成多核并行”；扩展性来自**多流**。
- **RSS hash 与 key、RETA、对称性**（是否支持 symmetric RSS）高度依赖 **NIC 与 PMD**；跨平台移植要重新验证。

---

## 1.4 第二部分：端口与队列配置（API 心智图）

典型顺序（与教程二一致，这里强调多队列）：

- `rte_eal_init()`
- `rte_eth_dev_configure(port_id, nb_rx_queue, nb_tx_queue, &port_conf)`
  - `port_conf.rx_adv_conf.rss_conf`：启用 RSS、指定 **rss_hf**（hash 类型位掩码，随 ethdev 演进）。
- 对每个 `q`：`rte_eth_rx_queue_setup(port, q, nb_rxd, socket, &rxconf, pool_q)`
  - **常见做法**：每队列一个 **mbuf pool**（减少争用）或共享 pool（省内存）；取舍见文末。
- `rte_eth_dev_start()`

### 1.4.1 RETA 配置

- 使用 `rte_eth_dev_rss_reta_update()`（或版本等价 API）把 queue id 写入 RETA 表项。
- 初学者可先用 **均匀映射**：hash 桶轮流指向各队列。

---

## 1.5 第三部分：多 worker 线程模型

### 1.5.1 典型拓扑

- **1× main lcore**：负责初始化、打印、信号处理（视应用）。
- **N× worker**：每个 worker **绑定一个 RX queue**（常见为 `queue_id == worker_index`），循环：

```text
while (running) {
    nb = rte_eth_rx_burst(port, queue_id, pkts, BURST_SIZE);
    for (i = 0; i < nb; i++) {
        /* echo: swap eth addrs or just count */
        /* minimal forward: send to tx_port/tx_queue */
    }
    rte_eth_tx_burst(tx_port, tx_queue, pkts, nb); /* 注意返回值与 mbuf 生命周期 */
}
```

### 1.5.2 并发与 mempool 标志（正确性）

- 若 **多个 worker 同时从同一 mempool 分配/释放**：需 **MP/MC** 或确认 PMD/应用侧不会并发触达同一无锁假设。
- 若 **每队列独立 pool 且每队列仅单 worker 使用**：可用更激进的 SP/SC 配置（前提：全链路无其他核触碰该 pool）。

---

## 1.6 第四部分：最小 Echo vs 最小 L2 Forward

### 1.6.1 Echo（单端口常见）

- **含义**：把收到的包从 **同一端口 TX** 回去（实验室常用；生产需考虑 MAC 交换学习与风暴）。
- **最小改动**：交换以太网 SA/DA 或保持原样（取决于对端是否能接受环回帧）。

### 1.6.2 L2 forward（双端口常见）

- **含义**：`port0 RX -> port1 TX`，反之亦然（类似 `testpmd` 的 mac 转发模式思想）。

### 1.6.3 TX 侧最容易踩的坑（必读）

- `rte_eth_tx_burst()` **返回值 < nb** 时：**未发送的 mbuf 指针仍有效**，需要 **重试或释放**；否则泄漏。
- TX 队列与 worker 映射要一致：多 worker 多 TX queue 时避免无序锁竞争（或采用集中 TX，但集中 TX常成为瓶颈）。

---

## 1.7 用 `testpmd` 先做能力验证（建议命令族）

> 具体子命令随 `testpmd` 版本变化；请以 `help` 输出为准。下面给**学习方向**而非保证逐字兼容的脚本。

- 查看端口 RSS 能力：`show port rx_rss_hash`（或等价命令）
- 配置 hash 字段：`port config all rss ip` / `rss all`（示例）
- 配置转发模式：`set fwd macswap` / `io` 等
- 观察队列统计：`show port stats all` 与 per-queue 统计（若 PMD 支持）

当你确认 **多队列 + RSS** 在 `testpmd` 下行为正确，再写 C 程序对照复现。

---

## 1.8 第五部分：最小 C 程序结构（骨架级，避免绑定某版本 API）

建议你自己新建 `minimal_fwd.c`，按以下模块拆分文件内函数：

- `parse_args()`：PCI allowlist、队列数、端口模式
- `init_port()`：`dev_configure` + RSS + `rx/tx_queue_setup`
- `init_mempools()`：每队列 pool 或共享 pool
- `launch_workers()`：`rte_eal_remote_launch(worker_main, arg, lcore)`
- `signal_handler()`：优雅退出，`force_quit` 标志

**不要复制粘贴大段 l3fwd**：第三步目标是 **结构清晰**，不是功能多。

---

## 1.9 性能与正确性检查清单

- **NUMA**：`port/socket/mempool/lcore` 同节点。
- **link/partner**：对端是否能接收环回帧；VLAN/MPLS 是否影响 RSS 输入字段。
- **统计**：`rte_eth_stats_get()` 观察 **imissed、rx_nombuf、errors**（字段名随版本略有差异）。

---

## 1.10 与教程（四）的衔接

当你能稳定跑多队列转发后，再引入：

- **硬件 offload**（checksum/TSO）减少每包 CPU。
- **flow API** 做精确分流（相对 RSS 更可控）。
- **IOVA 模式**与 **profiling** 解释“为什么某一核打满”。

---

## 1.11 参考

- DPDK **Sample Applications**：`l2fwd`、`l3fwd`（对照读，不要第一步就 fork 全部）。
- DPDK **Programmer’s Guide**：RSS、Ethdev、Multi-process（若你未来要拆控制面）。

---

*RSS/RETA 的具体可用位与默认 key 以你的 NIC datasheet + DPDK PMD release notes 为准；不要在不同代网卡间假设 hash 行为一致。*
