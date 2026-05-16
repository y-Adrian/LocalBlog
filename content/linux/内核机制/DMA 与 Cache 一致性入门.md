---
tags:
  - Linux
  - 内核
  - DMA
title: DMA 与 Cache 一致性入门
description: dma_map、一致性内存与设备树 dma-coherent 配合
date: 2026/05/16
---

# DMA 与 Cache 一致性入门

本文对应 [[成长路径/index|成长路径]] **高优先级**：理解 **CPU Cache** 与 **DMA** 的一致性，正确使用 **`dma_map_*`** 并在设备树中声明 **`dma-coherent`**（若硬件支持）。

---

## 学习目标

- 区分 **一致性映射** 与 **流式映射（streaming）**。
- 在驱动中完成 **map → 设备访问 → unmap/sync** 闭环。
- 对照设备树 **`dma-coherent`**、**`dma-ranges`** 属性。

---

## 为何需要 dma_map

CPU 写内存可能只更新 **Cache**，设备通过 **总线** 读 **DRAM**，若不同步会看到 **陈旧数据**。

| 方向 | 驱动应做 |
|------|----------|
| CPU 写 → 设备读 | `dma_sync_single_for_device` 或 map 时指定方向 |
| 设备写 → CPU 读 | `dma_sync_single_for_cpu` |

---

## API 速览

```c
dma_addr_t dma_handle;
void *cpu_addr = dma_alloc_coherent(dev, size, &dma_handle, GFP_KERNEL);
/* 设备与 CPU 看到一致内容，适合小缓冲、控制结构 */
dma_free_coherent(dev, size, cpu_addr, dma_handle);
```

流式（常见于网卡/SPI DMA 缓冲区）：

```c
struct device *dev = &pdev->dev;
dma_addr_t bus_addr = dma_map_single(dev, kvaddr, len, DMA_TO_DEVICE);
if (dma_mapping_error(dev, bus_addr))
    return -EIO;
/* 启动硬件 DMA */
dma_unmap_single(dev, bus_addr, len, DMA_TO_DEVICE);
```

 scatter-gather：

```c
dma_map_sg(dev, sg, nents, DMA_FROM_DEVICE);
```

---

## 一致性 vs 非一致性硬件

| 类型 | 说明 | 设备树 |
|------|------|--------|
| **IO coherent** | 硬件保证一致 | `dma-coherent;` |
| **非 coherent** | 必须软件 sync | 默认，依赖 map/sync |

查阅 SoC TRM：**ACE/CCI**、外设是否 **snoop**。

---

## 与设备树配合

```dts
my_device@0 {
    compatible = "vendor,mydev";
    reg = <0x0 0x1000>;
    interrupts = <GIC_SPI 42 IRQ_TYPE_LEVEL_HIGH>;
    dma-coherent;   /* 仅当硬件/总线支持 */
};
```

**`dma-ranges`** 描述 **子地址空间到父总线** 的映射，PCIe/某些 SoC 必需。

---

## 常见错误

| 现象 | 原因 |
|------|------|
| 偶发错误数据 | 未 sync、缓冲区在栈上 |
| 启动即 panic | `dma_mask` 不足，未 `dma_set_mask` |
| ARM 上 highmem | 用户缓冲区需 `get_user_pages` + `dma_map_page` |

设置掩码：

```c
ret = dma_set_mask_and_coherent(dev, DMA_BIT_MASK(32));
```

---

## 实践清单

- [ ] 在现有模块中打印 `dma_get_mask(dev)`
- [ ] 用 **streaming map** 做一次 TX，抓包验证 payload
- [ ] 阅读 TRM 确认外设是否 **coherent**

---

## 延伸阅读

- [[linux/学习路径/中断与下半部机制]]
- [[linux/驱动与模块/platform 驱动完整案例]]
- [[linux/内核机制/如何通过虚拟地址查找物理地址]]
