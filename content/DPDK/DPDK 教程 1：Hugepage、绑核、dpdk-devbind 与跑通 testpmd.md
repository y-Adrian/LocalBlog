---
tags:
  - DPDK
---

# 1 DPDK 教程（一）：Hugepage、绑核、`dpdk-devbind` 与跑通 `testpmd`

本文对应学习路径的第一步：**把运行环境搭到能稳定跑 `testpmd`**。完成后你应能解释：大页为何需要、CPU 隔离与亲和在 DPDK 里的意义、网卡如何从内核驱动解绑并交给 VFIO、以及 `testpmd` 交互的基本用途。

---

## 1.1 本文目标与验收标准

- **目标**：在 Linux 上完成 **大页预留**、**CPU 绑核/隔离（可选但强烈建议）**、**PCI 网卡绑定到 `vfio-pci`**，并成功启动 **`testpmd`** 进入交互提示符。
- **验收**：能执行 `show config fwd`、`show port info all`、简单 `start` / `stop`，且 `dmesg` 无 IOMMU/VFIO 致命错误；你知道如何用 `quit` 干净退出。

---

## 1.2 前置条件（严谨说明）

- **硬件**：一块被 DPDK **PMD 支持**的网卡（Intel/Mellanox 等）；具体型号需对照 DPDK **Hardware Feature Matrix**（随版本发布）。
- **软件**：已安装与你目标 DPDK **匹配**的构建产物或发行版包；内核启用 **IOMMU**（生产与 VFIO 常见要求；下文给验证思路）。
- **权限**：绑定网卡、挂载 hugetlbfs、部分 `sysfs` 写入通常需要 **root** 或等价 capability。
- **版本差异**：命令行参数、工具脚本路径在不同 DPDK 大版本可能变化；文中示例以常见布局为准，**以你安装的 `dpdk-testpmd -h` 与 `usertools/dpdk-devbind.py -h` 为准**。

---

## 1.3 第一部分：Hugepage（大页）

### 1.3.1 解决什么问题

- **TLB 压力**：高 PPS 下频繁访问报文 buffer，4KiB 页导致 TLB miss 成本上升。
- **分配与映射的可预期性**：DPDK EAL 倾向使用 **mmap 大段大页** 作为数据面内存基础（与 `memseg`、DMA 元数据管理强相关）。

### 1.3.2 你需要掌握的概念

- **Hugepage size**：常见 **2MiB**；部分平台支持 **1GiB**（配置更难但 TLB 覆盖更大）。
- **预留 vs 动态**：可在启动参数 `hugepages=...` 预留，或通过 `sysfs` 写入 `nr_hugepages`；**NUMA 系统要对每个 node 预留**（常见踩坑）。

### 1.3.3 Linux 上常见配置思路（示例，按你的 NUMA 拓扑调整）

**查看大页与 NUMA：**

```bash
grep -H . /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages
numactl --hardware
```

**按 socket 预留（示例：每个 node 预留 1024 个 2MiB 页，约 2GiB）：**

```bash
echo 1024 | sudo tee /sys/devices/system/node/node0/hugepages/hugepages-2048kB/nr_hugepages
echo 1024 | sudo tee /sys/devices/system/node/node1/hugepages/hugepages-2048kB/nr_hugepages
```

若写入后 `Free` 仍为 0，检查是否被 **cgroup hugetlb 限制**、**权限**、或 **碎片化**（先预留再启动大量吃内存进程）。

### 1.3.4 挂载 hugetlbfs（若你的环境需要显式挂载）

部分发行版已挂载；否则类似：

```bash
sudo mkdir -p /mnt/huge
sudo mount -t hugetlbfs nodev /mnt/huge
```

**DPDK EAL** 通常仍通过内部机制使用大页；挂载点是否必须取决于版本与配置，以 **Programmer’s Guide / Linux EAL** 为准。

### 1.3.5 EAL 侧常见参数（理解即可，第二步会反复用）

- **`--socket-mem`**：每个 socket 预分配内存（格式随版本文档）。
- **`-l` / `-c`**：逻辑核掩码（与绑核强相关）。

---

## 1.4 第二部分：绑核与 CPU 隔离

### 1.4.1 解决什么问题

- **抖动**：内核调度器把 DPDK polling 线程在核间迁移 → cache 冷、延迟尖峰。
- **干扰**：内核 ksoftirqd、其他进程与 DPDK **抢同核** → PPS 上不去。

### 1.4.2 工程上两层手段

- **隔离（isolcpus / nohz_full 等）**：把某些核从通用调度里“挪开”，减少背景任务（需结合发行版与内核文档，错误配置会影响可维护性）。
- **亲和（taskset / DPDK `-l`）**：让 **testpmd / PMD** 固定跑在指定 lcore。

### 1.4.3 DPDK 视角的最低要求（第一步闭环）

即使不做 `isolcpus`，也要做到：

- **`testpmd` 的 master 与 forwarding lcore** 明确指定在**离网卡近的 NUMA node** 上。
- 避免把 DPDK 与 **重负载编译/浏览器** 绑在同一批核上对比压测。

---

## 1.5 第三部分：`dpdk-devbind`（或等价脚本）

### 1.5.1 解决什么问题

- Linux 默认由 **内核 netdev 驱动**（如 `ixgbe`、`i40e`、`mlx5_core`）管理网卡；DPDK 需要 **用户态 PMD** 直接访问设备（VFIO/UIO 路径）。

### 1.5.2 典型流程（Intel/常见 PCI 网卡）

**查看 PCI 与当前驱动：**

```bash
sudo usertools/dpdk-devbind.py --status
```

**绑定到 `vfio-pci`（现代推荐）：**

```bash
sudo modprobe vfio-pci
sudo usertools/dpdk-devbind.py -b vfio-pci 0000:03:00.0
```

其中 `0000:03:00.0` 用你机器上的 **PCI BDF** 替换。

### 1.5.3 IOMMU 与 VFIO（必须理解的“硬门槛”）

- **Intel**：内核参数常见为 `intel_iommu=on iommu=pt`（是否用 `pt` 依安全与平台策略）。
- **AMD**：`amd_iommu=on`。
- **验证**：`dmesg | grep -i iommu`，并确认 VFIO 容器能创建（失败时常与 **IOMMU 组**、ACS、虚拟化嵌套有关）。

### 1.5.4 常见问题

- **`VFIO: No IOMMU groups found`**：IOMMU 未启用或固件/BIOS 关闭。
- **绑定后 `ip link` 看不到接口**：正常现象；要回到内核栈需 **解绑回内核驱动**。
- **容器内绑卡**：通常需要 **privileged**、设备直通、以及 hugepage 挂载策略；第一步建议先在 **bare metal 或 VM 直通** 上闭环。

---

## 1.6 第四部分：跑通 `testpmd`

### 1.6.1 `testpmd` 是什么

- DPDK 自带的 **示例/调试程序**：验证 PMD、队列、offload、统计与转发模式；**不是**生产转发平台，但是**官方第一调试工具**。

### 1.6.2 最小启动示例（按你的 PCI 地址与核掩码修改）

```bash
sudo dpdk-testpmd \
  -l 0-3 \
  -n 4 \
  --socket-mem 1024,1024 \
  -a 0000:03:00.0 \
  -- \
  -i
```

参数说明（概念层）：

- **`-l`**：允许使用的 lcore 列表。
- **`-n`**：memory channel 提示（与部分平台内存控制器提示相关；以文档为准）。
- **`--socket-mem`**：每 NUMA socket 预分配内存（示例数值仅演示）。
- **`-a`**：allowlist PCI 设备（旧版本可能用 `-w`；以 `-h` 为准）。
- **`--` 之后**：`testpmd` 自有参数；**`-i` 交互模式**。

### 1.6.3 交互里建议立刻运行的命令

```text
show port info all
show config fwd
```

然后可尝试（两端口环回或链路伙伴场景才更有意义）：

```text
set fwd io
start
show port stats all
stop
quit
```

### 1.6.4 排障清单（第一步最值得背）

- **EAL 无法初始化 hugepage**：预留不足或 mount/权限问题。
- **PCI 无法 probe**：驱动未绑定 VFIO、IOMMU、或 allowlist 写错 BDF。
- **端口 link down**：线缆/对端、FEC、光模块；`testpmd` 里可看 `show port info` 的 link 状态。

---

## 1.7 与后续教程的衔接

- **教程（二）**：在 `testpmd` 能跑的前提下，用 `show rxq pkt` 等（随版本）或阅读源码，把 **RX burst → mbuf → mempool** 串起来。
- **教程（三）**：在 `testpmd` 里练习 **RSS/多队列**（`port config all rss ...`、`set fwd` 相关）再迁移到自写 l3fwd 最小样例。

---

## 1.8 参考文档（权威）

- DPDK **Getting Started Guide**（Linux）。
- DPDK **Testpmd Application User Guide**。
- DPDK **Programmer’s Guide**：EAL、Linux-specific notes。

---

*命令与参数请以你安装的 DPDK release 的 `-h` 与官方文档为准；不同发行版打包路径可能将 `dpdk-devbind.py` 放在 `/usr/share/dpdk/usertools/` 等处。*
