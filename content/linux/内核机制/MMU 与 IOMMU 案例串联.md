---
tags:
  - Linux
  - 内核
  - MMU
title: MMU 与 IOMMU 案例串联
description: 从虚拟地址到物理地址，再到设备 DMA 重映射
date: 2026/05/16
---

# MMU 与 IOMMU 案例串联

本文对应 [[成长路径/index|成长路径]] **中优先级**：在 [[linux/内核机制/如何通过虚拟地址查找物理地址]] 基础上，补上 **IOMMU** 与 **DMA 地址** 的完整图景。

---

## 两条地址路径

| 路径 | 谁用 | 转换 |
|------|------|------|
| **CPU MMU** | 内核/用户 VA | 页表 → PA |
| **IOMMU** | 设备 DMA 地址 | IOVA → PA |

CPU 看到的 **PA** 与设备 DMA 的 **PA** 可经 IOMMU **隔离**、**映射** 不同。

---

## 案例：网卡 DMA

1. 驱动 `dma_alloc_coherent` 得到 **cpu_addr** 与 **dma_handle**。
2. 将 **dma_handle** 写入设备描述符。
3. 设备发起 DMA → 若经 IOMMU，**dma_handle** 实为 **IOVA**。
4. CPU 读缓冲区用 **cpu_addr**（走 MMU）。

若无 IOMMU，**dma_handle** 可能等于 **物理地址**（仍建议用 DMA API）。

---

## 与 SMMU / VT-d

ARM **SMMU**、x86 **VT-d** 为 IOMMU 实现。设备树常见：

```dts
iommu = <&smmu>;
```

缺 IOMMU 时，错误映射可能导致 **损坏其他内存**。

---

## 调试

- `cat /proc/iomem` 看物理布局。
- `debugfs` / vendor 工具查看 **SMMU 故障**（实现相关）。
- 结合 [[linux/内核机制/DMA 与 Cache 一致性入门]]。

---

## 延伸阅读

- [[linux/内核机制/如何通过虚拟地址查找物理地址]]
- [[linux/内核机制/kmalloc 与 vmalloc]]
