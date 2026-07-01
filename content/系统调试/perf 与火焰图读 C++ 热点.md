---
tags:
  - 调试
  - perf
  - C++
title: perf 与火焰图读 C++ 热点
description: perf record/report/script、火焰图生成与解读、C++ 特有注意事项
date: 2026/05/16
---

# perf 与火焰图读 C++ 热点

性能优化的第一步是找到热点——哪个函数占用了最多 CPU？**perf + 火焰图**是 Linux 上最主流的 CPU 性能剖析手段，适用于用户态 C/C++、内核代码，以及 DPDK 数据面。

---

## 1. perf 基础

### 1.1 安装

```bash
# Ubuntu/Debian
sudo apt install linux-perf linux-tools-$(uname -r)

# 检查
perf --version
```

### 1.2 采样（record）

```bash
# 基本用法：以 99Hz 采样，带调用栈
perf record -g -F 99 ./app

# 完整调用栈选项（-g 只采集部分栈，dwarf 更完整）
perf record -g --call-graph dwarf -F 99 ./app

# 对已运行进程采样（需要 PID）
perf record -g --call-graph dwarf -F 99 -p $(pgrep app) -- sleep 30

# 对指定 CPU 核心采样（DPDK 数据面场景）
perf record -C 2,3 -g --call-graph dwarf -F 99 -- sleep 30
```

**关键参数：**

| 参数 | 说明 |
|------|------|
| `-g` | 采集调用栈（frame pointer 方式，快但可能不完整） |
| `--call-graph dwarf` | 用 DWARF 信息展开栈（更完整，数据量更大） |
| `--call-graph lbr` | 用 Last Branch Record（Intel 硬件，开销最小） |
| `-F 99` | 采样频率 99Hz（避免与 100Hz 时钟同步造成偏差） |
| `-a` | 系统级采样（所有 CPU 所有进程） |

### 1.3 查看报告（report）

```bash
perf report
```

交互式界面：用方向键选择函数，Enter 展开调用树，`q` 退出。

```text
Samples: 12K of event 'cycles', Event count (approx.): 9,876,543,210
Overhead  Command  Shared Object      Symbol
  34.12%  app      app                [.] process_packet
  18.45%  app      libstdc++.so.6     [.] std::string::find
   8.23%  app      app                [.] lookup_table
   5.67%  app      [kernel]           [.] __memcpy_avx_unaligned
```

`Overhead` 列是该函数（含自身代码，不含被调用者）占的 CPU 采样比例。

---

## 2. 火焰图（Flame Graph）

火焰图把调用栈可视化，**横轴 = CPU 占比，纵轴 = 调用深度**，让热点一眼可见。

### 2.1 生成火焰图

```bash
# 1. 采集数据
perf record -g --call-graph dwarf -F 99 -- ./app

# 2. 转换为文本格式
perf script > out.perf

# 3. 用 Brendan Gregg 的工具生成 SVG
git clone https://github.com/brendangregg/FlameGraph.git
./FlameGraph/stackcollapse-perf.pl out.perf | ./FlameGraph/flamegraph.pl > fg.svg

# 4. 打开 SVG（可在浏览器里交互点击）
open fg.svg   # macOS
xdg-open fg.svg  # Linux
```

### 2.2 解读火焰图

```
        ┌──────────────────────────────────────────┐
        │              main                        │  ← 每个框宽度 = 该函数在采样中的占比
        │          ────────────────                │
        │       process_packet (34%)               │  ← 宽 = 热点！
        │    ─────────────────────────             │
        │  parse_header  lookup_table  checksum    │  ← 子函数分布
        └──────────────────────────────────────────┘
```

- **宽而平**的框：自身代码是热点（没有子函数，说明时间花在这个函数的指令里）
- **宽但有高子塔**：热点在子函数里，本函数只是路由
- **很深的调用栈**：C++ 模板/STL 的典型表现，关注最底部的叶子

### 2.3 差分火焰图（对比优化前后）

```bash
# 优化前
perf record -g --call-graph dwarf -F 99 -- ./app_old
perf script > before.perf

# 优化后
perf record -g --call-graph dwarf -F 99 -- ./app_new
perf script > after.perf

# 生成差分图（红 = 增加，蓝 = 减少）
./FlameGraph/stackcollapse-perf.pl before.perf > before.folded
./FlameGraph/stackcollapse-perf.pl after.perf  > after.folded
./FlameGraph/difffolded.pl before.folded after.folded | ./FlameGraph/flamegraph.pl > diff.svg
```

---

## 3. C++ 特有注意事项

### 3.1 名字修饰（Name Mangling）

C++ 函数名在符号表里是 mangled 的，perf report 默认会 demangle，但有时需要手动：

```bash
# 手动 demangle
echo "_ZN3Foo7processEPKci" | c++filt
# 输出：Foo::process(char const*, int)
```

### 3.2 模板展开后的符号膨胀

模板函数每个实例化都是独立符号，火焰图里可能看到：

```
std::vector<Packet>::push_back(Packet&&)
std::vector<int>::push_back(int&&)
...
```

关注**业务层**的函数名，STL 内部函数通常不是真正的热点。

### 3.3 内联函数消失

`-O2` 及以上会大量内联函数，导致在 perf report 里看不到那个函数的名字，热点归到调用它的上层函数。

解决：临时加 `-fno-inline` 对比（可能影响性能），或用 `__attribute__((noinline))` 阻止特定函数内联：

```cpp
__attribute__((noinline)) void hot_function() { ... }
```

### 3.4 LTO（Link-Time Optimization）

LTO 会在链接时合并和优化，导致符号可能被合并或消失，建议对比**有 LTO 和无 LTO** 的版本，确认热点归因正确。

---

## 4. DPDK 数据面采样

DPDK 数据面跑在独占 CPU 核上（`isolcpus`），需要对特定核心采样：

```bash
# 查看 DPDK worker 跑在哪个核
cat /proc/$(pgrep dpdk_app)/status | grep Cpus_allowed

# 对核 2 和 3 采样 30 秒
perf record -C 2,3 -g --call-graph dwarf -F 99 -- sleep 30

# 关注热点：
# - rte_eth_rx_burst（PMD poll loop，预期热点）
# - rte_mbuf_raw_alloc / rte_pktmbuf_free（内存池操作）
# - 业务处理函数
# - 如果 __memcpy 占比很高 → 可能有不必要的拷贝
```

---

## 5. 与 ftrace/bpftrace 的分工

| 工具 | 适合场景 | 开销 |
|------|----------|------|
| **perf** | CPU 热点、火焰图、硬件事件（cache miss 等） | 低（采样） |
| **ftrace** | 内核函数调用链、延迟测量 | 低~中 |
| **bpftrace** | 自定义事件聚合、直方图、跨层追踪 | 低~中 |
| **Valgrind** | 内存错误、指令级性能分析 | 高（模拟） |

---

## 6. 实践清单

- [ ] 用 `perf record -g` 对自己写的应用采集 30 秒数据
- [ ] 生成火焰图，找到 `Overhead > 5%` 的函数
- [ ] 对 DPDK 数据面核心采样，确认 PMD poll 占比正常（通常 > 80%）
- [ ] 优化一个热点后用差分火焰图对比效果

---

## 延伸阅读

- [[linux/内核机制/eBPF 与 bpftrace 入门]]（更灵活的观测方式）
- [[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]
- [[系统调试/排障工具链一张图]]
- [Brendan Gregg 火焰图教程](https://www.brendangregg.com/flamegraphs.html)
