---
tags:
  - Linux
  - 驱动
  - input
  - RTC
  - watchdog
title: Input RTC Watchdog 子系统速览
description: input/RTC/watchdog 子系统模型、DT 入口、用户态接口与选型建议
date: 2026/05/16
---

# Input / RTC / Watchdog 子系统速览

键盘触摸、实时时钟、看门狗在产品里极常见，但内核里各自是 **独立子系统**，不要都写成「一个杂项字符设备」。本文对应 [[成长路径/index|成长路径]] 低优先级：按原理图外设 **选学一条**，建立正确入口。

I2C/SPI 外设接法见 [[linux/学习路径/I2C 与 SPI 驱动选学]]；platform 资源获取见 [[platform 驱动完整案例]]。

---

## 1. 读完能带走什么

- 能说出三个子系统各自的 **注册 API / 用户态节点 / 典型 DT compatible**。  
- 知道何时该用子系统框架，而不是裸 `misc_register`。  
- 有一条「有硬件 → 查 binding → 找 mainline/vendor 驱动」的路径。

---

## 2. 总览

```mermaid
flowchart LR
  HW[按键/触摸/RTC芯片/WDT] --> Bus[GPIO/I2C/SPI/platform]
  Bus --> Sub[input / rtc / watchdog 子系统]
  Sub --> Dev[/dev/input/eventX 等]
  Dev --> App[evtest / hwclock / 喂狗进程]
```

| 子系统 | 内核对象 | 用户态常见入口 |
|--------|----------|----------------|
| **Input** | `struct input_dev` | `/dev/input/eventX` |
| **RTC** | `struct rtc_device` | `/dev/rtc0`、`hwclock` |
| **Watchdog** | `struct watchdog_device` | `/dev/watchdog` |

---

## 3. Input 子系统

### 3.1 模型

驱动填充并 `input_register_device()`：

- 事件类型：`EV_KEY`（按键）、`EV_ABS`（触摸绝对坐标）、`EV_REL` 等；  
- 上报：`input_report_key` / `input_report_abs` + `input_sync`。

内核把硬件差异收敛成 **evdev** 流，应用用同一套 `struct input_event`。

### 3.2 设备树与现成驱动

| 场景 | 常见 compatible |
|------|-----------------|
| GPIO 按键 | `gpio-keys` |
| 电容触摸 | 如 `goodix,gt9xx`（以 binding 为准） |

优先用现成驱动 + DT，而不是从零写 input。用户态验证：

```bash
evtest /dev/input/event0
cat /proc/bus/input/devices
```

### 3.3 与字符设备关系

Input **不是** 简单的 `read` 字符串设备；强行用 chardev 上报按键会失去 **键码标准、多读者、syn 同步** 等生态。除非极简 MCU 风格产品，否则走 input。

---

## 4. RTC 子系统

### 4.1 模型

板级 **RTC 芯片**（I2C/SPI）或 SoC 内置 RTC：驱动实现 `rtc_class_ops`（`read_time` / `set_time` / alarm 等），`devm_rtc_device_register()`。

用户态：

```bash
hwclock -r              # 读硬件钟
hwclock -w              # 系统时间写入 RTC
# systemd 环境可用 timedatectl
```

### 4.2 为何要子系统

- 统一 `/dev/rtc*` 与 sysfs；  
- alarm 可作 **唤醒源**（与 [[Runtime PM 与休眠唤醒入门]] 联动）；  
- 多 RTC 时有明确主从选择逻辑。

掉电靠 RTC 电池/超级电容；软件层解决不了「没后备电」。

---

## 5. Watchdog 子系统

### 5.1 模型

```c
static struct watchdog_device wdd = {
    .info = &info,
    .ops = &ops,          /* start / stop / ping / set_timeout */
    .min_timeout = 1,
    .max_timeout = 60,
};
devm_watchdog_register_device(dev, &wdd);
```

用户态打开 `/dev/watchdog` 后必须 **定期 ping**（`write` 或 `ioctl` keepalive）；超时未喂狗 → 硬件复位。

### 5.2 产品要点

| 项 | 说明 |
|----|------|
| **timeout** | 需覆盖最坏业务卡顿，又不能太长导致「假死很久才复位」 |
| **nowayout** | 打开后可能无法关闭喂狗，防误关 |
| **与健康检查** | 用户态监控进程喂狗；见 [[linux/OTA/远程日志与最小可观测]] |

调试阶段小心：调试器断住 CPU 可能 **来不及喂狗而复位**——可临时加长 timeout 或用调试配置关掉 WDT。

---

## 6. 学习顺序建议

1. 看原理图：有无按键/触摸、RTC、WDT。  
2. 只挑 **实际焊接的那一个**。  
3. 查 `Documentation/devicetree/bindings/` 与 `drivers/input`、`drivers/rtc`、`drivers/watchdog`。  
4. 先 DT + 现成驱动 bring-up，再考虑改厂商驱动。

---

## 7. 检查清单

- [ ] 按键能在 `evtest` 看到正确 keycode  
- [ ] 掉电后 RTC 时间不跳（有后备电前提下）  
- [ ] 杀掉喂狗进程后，系统在 timeout 内复位  
- [ ] 休眠唤醒若依赖 RTC alarm，已按 PM 文验证  

---

## 8. 延伸阅读

- [[linux/学习路径/I2C 与 SPI 驱动选学]]  
- [[linux/驱动与模块/platform 驱动完整案例]]  
- [[Runtime PM 与休眠唤醒入门]]  
- [[linux/OTA/远程日志与最小可观测]]
