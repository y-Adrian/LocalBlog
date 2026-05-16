---
tags:
  - Linux
  - 驱动
  - platform
title: platform 驱动完整案例
description: compatible 匹配、probe 获取资源与 remove 释放
date: 2026/05/16
---

# platform 驱动完整案例

本文对应 [[成长路径/index|成长路径]] **高优先级**：从 **设备树** 到 **platform_driver**，完成 **reg / interrupt / clock** 获取与 **对称 remove**。

---

## 学习目标

- 编写 **`compatible` 匹配** 的 `platform_driver`。
- 在 **probe** 中解析 **IO 内存、IRQ、clock**；在 **remove** 中释放。
- 与 [[linux/学习路径/设备树实战指南]] 节点一一对应。

---

## 设备树节点（示例）

```dts
mydev@10030000 {
    compatible = "vendor,mydev";
    reg = <0x10030000 0x1000>;
    interrupts = <GIC_SPI 55 IRQ_TYPE_LEVEL_HIGH>;
    clocks = <&clk_uart>;
    clock-names = "apb";
    status = "okay";
};
```

---

## 驱动骨架

```c
static int mydev_probe(struct platform_device *pdev)
{
    struct resource *res;
    void __iomem *base;
    int irq, ret;
    struct clk *clk;

    res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
    base = devm_ioremap_resource(&pdev->dev, res);
    if (IS_ERR(base))
        return PTR_ERR(base);

    irq = platform_get_irq(pdev, 0);
    if (irq < 0)
        return irq;

    clk = devm_clk_get(&pdev->dev, "apb");
    if (IS_ERR(clk))
        return PTR_ERR(clk);
    ret = clk_prepare_enable(clk);
    if (ret)
        return ret;

    ret = devm_request_irq(&pdev->dev, irq, mydev_irq, 0, "mydev", priv);
    /* 注册 miscdevice / 初始化硬件 */
    platform_set_drvdata(pdev, priv);
    return 0;
}

static void mydev_remove(struct platform_device *pdev)
{
    /* devm_* 自动释放；仅清理非 devm 资源 */
}

static const struct of_device_id mydev_of_match[] = {
    { .compatible = "vendor,mydev" },
    { }
};
MODULE_DEVICE_TABLE(of, mydev_of_match);

static struct platform_driver mydev_driver = {
    .probe  = mydev_probe,
    .remove = mydev_remove,
    .driver = {
        .name = "mydev",
        .of_match_table = mydev_of_match,
    },
};
```

---

## probe 检查清单

| 步骤 | 命令/代码 |
|------|-----------|
| 节点存在 | `/proc/device-tree/.../status` |
| 驱动绑定 | `/sys/bus/platform/devices/.../driver` |
| 中断号 | `cat /proc/interrupts \| grep mydev` |
| 寄存器 | `devm_ioremap` 后读版本寄存器 |
| 时钟 | `clk_get_rate` 打印 |

失败时 **dmesg** 常见：`probe failed with error -2`（资源未找到）→ 查 **clock-names**、**interrupts** 拼写。

---

## remove 对称性

| 资源 | 推荐 API |
|------|----------|
| IO 映射 | `devm_ioremap_resource` |
| IRQ | `devm_request_irq` |
| clock | `devm_clk_get` + `clk_disable_unprepare` 在 remove 前若未 devm |
| DMA | `dma_free_coherent` |

**避免** probe 失败路径泄漏：使用 **`devm_*`** 或 `goto err_free` 链。

---

## 与字符设备衔接

probe 成功后注册 **miscdevice** 或 **cdev**，应用层 `/dev/mydev` 见 [[linux/学习路径/字符设备驱动入门]]。

---

## 实践清单

- [ ] 为一块真实或 QEMU 板添加 `vendor,mydev` 节点
- [ ] probe 打印 `reg` 物理地址与 `irq`
- [ ] `rmmod` 后确认 sysfs 节点消失、无 use-after-free

---

## 延伸阅读

- [[linux/驱动与模块/sysfs 与 proc 调试接口]]
- [[linux/内核机制/DMA 与 Cache 一致性入门]]
- [[linux/驱动与模块/Linux 内核模块开发实战]]
