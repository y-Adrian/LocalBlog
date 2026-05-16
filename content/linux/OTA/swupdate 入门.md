---
tags:
  - Linux
  - OTA
title: swupdate 入门
description: 描述文件、分区升级与回滚钩子
date: 2026/05/16
---

# swupdate 入门

本文对应 [[成长路径/index|成长路径]] **OTA 高优先级**：用 **swupdate** 做 **签名升级包** 与 **A/B** 协作。

---

## 组件

| 部分 | 作用 |
|------|------|
| **sw-description** | 升级步骤、镜像、分区 |
| **swupdate** 守护进程 | 解析并执行 |
| **libconfig** | 配置语法 |

---

## 最小 sw-description 思路

```text
software = {
  version = "1.0";
  images = (
    {
      filename = "rootfs.ext4.gz";
      device = "/dev/mmcblk0p3";
      type = "raw";
      compressed = "zlib";
    }
  );
}
```

实际需匹配 **分区布局** 与 **压缩格式**。

---

## 与 A/B

- 写入 **非活动 slot** 分区。
- **`bootloader`** 脚本切换 `bootslot`。
- 见 [[linux/OTA/A-B 分区与回滚策略]]。

---

## 签名

使用 **CMS** 签名 `.swu` 包；公钥烧录在 **recovery** 或 **U-Boot verify**。

---

## 实践清单

- [ ] 在 Buildroot 启用 `BR2_PACKAGE_SWUPDATE`
- [ ] 制作 `.swu` 并在目标板 `swupdate -i` 试升级

---

## 延伸阅读

- [[linux/学习路径/最小可启动工程指南]]
