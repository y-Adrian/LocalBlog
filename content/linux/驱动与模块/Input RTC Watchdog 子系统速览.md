---
tags:
  - Linux
  - 驱动
title: Input RTC Watchdog 子系统速览
description: 常见子系统驱动按产品选学
date: 2026/05/16
---

# Input / RTC / Watchdog 子系统速览

本文对应 [[成长路径/index|成长路径]] **低优先级**：产品涉及键盘触摸、时钟、看门狗时的 **内核子系统入口**。

---

## Input

- 子系统：`input_register_device`，事件 **EV_KEY / EV_ABS**。
- 设备树：`compatible` 如 `gpio-keys`、`goodix,gt9xx`。
- 用户态：`/dev/input/eventX`、`evtest`。

---

## RTC

- 硬件时钟芯片 **I2C/SPI**；`rtc_device_register`。
- 用户态：`hwclock`、`timedatectl`（若 systemd）。

---

## Watchdog

```c
wd = devm_watchdog_register_device(dev, &wdd);
```

- 用户态：`/dev/watchdog`，需定期 **ioctl KEEPALIVE**。
- 与 [[linux/OTA/远程日志与最小可观测]] 中 **健康检查** 配合。

---

## 学习建议

按 **原理图外设** 只学一项，参考 **Documentation/devicetree/bindings** 与厂商驱动。

---

## 延伸阅读

- [[linux/学习路径/I2C 与 SPI 驱动选学]]
- [[linux/驱动与模块/platform 驱动完整案例]]
