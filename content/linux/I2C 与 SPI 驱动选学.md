---
tags:
  - Linux
  - 嵌入式
  - 学习路径
title: I2C 与 SPI 驱动选学
description: 按硬件选学——总线模型、设备树、内核 API 与用户态调试
---

# I2C 与 SPI 驱动选学

本文是 **嵌入式 Linux 学习路径** 第七阶段（**按硬件选学**）：当板上有 **I2C/SPI 传感器、EEPROM、显示屏控制器** 等外设时，理解 **总线驱动 + 设备驱动** 分层、**设备树描述** 与 **内核消息 API**。无此类硬件时可略读概念，待项目需要再实操。

---

## 学习目标

- 区分 **Adapter/Controller 驱动** 与 **Client/设备驱动**。
- 在 DTS 中正确挂 **i2c/spi 子节点**，配置 **reg（地址）/ cs-gpios / clock-frequency**。
- 使用 **`i2c_transfer` / `spi_sync`** 或 **regmap** 读写寄存器。
- 用 **`i2cdetect` / `spidev`** 做 bring-up；理解 **与字符设备驱动的关系**。

---

## 总线模型对比

| | **I2C** | **SPI** |
|---|---------|---------|
| 拓扑 | 多设备 **共享** SDA/SCL，**7/10 位地址** | 每设备通常 **独立 CS**，SCK/MOSI/MISO 共享 |
| 速度 | 标准/快速/高速模式 | 由控制器与外设决定，常更高 |
| DT 关键 | **`reg = <0x48>`** 从地址 | **`reg = <0>`** 常表示 chip select 索引 |
| 用户态 | **`/dev/i2c-N`**、`i2c-tools` | **`/dev/spidevX.Y`**（spidev） |

---

## 设备树示例（示意，以 binding 为准）

### I2C 传感器

```dts
&i2c1 {
	clock-frequency = <400000>;
	status = "okay";

	sensor@48 {
		compatible = "vendor,tmp123";
		reg = <0x48>;
		interrupt-parent = <&gpio0>;
		interrupts = <5 IRQ_TYPE_LEVEL_LOW>;
	};
};
```

### SPI 外设

```dts
&spi0 {
	status = "okay";
	cs-gpios = <&gpio0 10 GPIO_ACTIVE_LOW>;

	flash@0 {
		compatible = "jedec,spi-nor";
		reg = <0>;
		spi-max-frequency = <50000000>;
	};
};
```

---

## 内核驱动结构

### I2C client 驱动

```c
static const struct of_device_id tmp123_of_match[] = {
	{ .compatible = "vendor,tmp123" },
	{ }
};
MODULE_DEVICE_TABLE(of, tmp123_of_match);

static int tmp123_probe(struct i2c_client *client,
			const struct i2c_device_id *id)
{
	/* i2c_smbus_read_byte_data / regmap */
	return 0;
}

static struct i2c_driver tmp123_driver = {
	.probe = tmp123_probe,
	.remove = tmp123_remove,
	.driver = {
		.name = "tmp123",
		.of_match_table = tmp123_of_match,
	},
};
```

### SPI 驱动

- **`struct spi_driver`** + **`spi_device`**；
- **`spi_setup`** 配置 **mode、bits_per_word、max_speed_hz**；
- 传输：**`spi_write_then_read`**、**`spi_sync` + `spi_transfer`**。

### regmap（推荐）

- 统一 **I2C/SPI/MMIO** 寄存器访问；减少重复 **retry/locking** 样板代码。

---

## Bring-up 顺序（资深习惯）

- **硬件**：示波器/逻辑分析仪看 **波形、上拉、地址冲突**。
- **Boot 日志**：adapter **probe** 是否成功。
- **用户态探测**：
  ```bash
  i2cdetect -y 1
  i2cget -y 1 0x48 0x00
  ```
  SPI 可用 **spidev** 小工具或 **flashrom**（Nor）。
- **再写内核驱动** 或确认 **已有 hwmon/iio 驱动** 是否已绑定。

---

## 子系统绑定

| 外设类型 | 常注册到 |
|----------|----------|
| 温湿度 | **hwmon** / **iio** |
| 加速度计 | **iio** |
| 输入触摸 | **input** |
| RTC | **rtc** |

**优先查 mainline** 是否已有驱动；**仅写 compatible 字符串** 匹配即可的情况不少。

---

## 与字符设备的关系

- **总线驱动** 不直接等于 `/dev/xxx`；**hwmon** 导出 **`/sys/class/hwmon/`**，**iio** 导出 **`/sys/bus/iio/`**。
- **misc/spidev** 把 **SPI 总线暴露给用户态**——快速原型可用，**产品化** 常收回内核驱动以保证 **并发与权限**。

---

## 常见坑

- **I2C 地址** 8 位 vs 7 位（dt 里 **7 位**）。
- **SPI mode** CPOL/CPHA 与外设手册不一致 → 读到 **0xFF/0x00**。
- **regulator/clock** 未 enable → **-EPROBE_DEFER** 链。
- **长走线** 无适当 **上拉/降速** → 偶发 NACK。

---

## 实践练习（有硬件时）

- [ ] **`i2cdetect`** 看到设备地址，与 dts **`reg`** 一致。
- [ ] 加载 **mainline 或 vendor 驱动**，**`/sys/class/hwmon`** 出现 **`temp1_input`** 等。
- [ ] 读 **数据手册** 一个 **WHO_AM_I** 寄存器，用 **i2cget** 验证。
- [ ] （选做）写 **最小 probe** 只 **dev_info 打印 chip id**。

---

## 阶段验收

- [ ] 解释 **adapter 与 client** 区别。
- [ ] 从 dts 节点画出 **到驱动 probe 的匹配链**。
- [ ] 说明 **何时用 spidev、何时写内核驱动**。

---

## 下一阶段衔接

- **Yocto/Buildroot**：把 **内核模块或设备树补丁** 打包进镜像。
- **内核子系统深入**：**IIO 缓冲与 triggered 采样**（工业采集方向）。

---

## 参考

- **`Documentation/i2c/`**、**`Documentation/spi/`**
- **`Documentation/devicetree/bindings/i2c/`**、**`.../spi/`**
- *Linux Device Drivers* 相关章节

---

*无 I2C/SPI 外设时可跳过实操；**UART/GPIO** 路径由字符设备与设备树阶段已覆盖。*
