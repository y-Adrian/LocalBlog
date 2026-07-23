---
tags:
  - Linux
  - OTA
  - swupdate
title: swupdate 入门
description: sw-description、.swu 包、签名、与 A/B 协作及板级试升级清单
date: 2026/05/16
---

# swupdate 入门

嵌入式 OTA 常见选择之一是 **swupdate**：用描述文件声明「把哪些镜像写到哪些设备」，打成 **`.swu`** 包，可选 **CMS 签名**。本文对应 [[成长路径/index|成长路径]] OTA 高优先级，帮你建立可试跑的最小闭环；A/B 细节见 [[A-B 分区与回滚策略]]。

---

## 1. 读完能带走什么

- 说清 **sw-description / swupdate 进程 / .swu** 三者关系。  
- 能读懂一份最小 `images` 描述，并知道要和分区表对齐。  
- 知道 CMS 签名公钥放哪、与 Secure Boot 分层。  
- 有 Buildroot/板上试升级检查清单。

---

## 2. 场景与问题

| 目标 | swupdate 提供什么 |
|------|-------------------|
| 字段升级 rootfs / kernel | 按 description 写块设备或文件 |
| 防假包 | CMS 验签 |
| 与 A/B 协作 | 写 inactive slot + 钩子切 slot |

```mermaid
flowchart LR
  Host[主机打包 .swu] --> Dev[板上 swupdate -i]
  Dev --> Parse[解析 sw-description]
  Parse --> Verify[可选 CMS 验签]
  Verify --> Flash[写分区/文件]
  Flash --> Hook[bootloader 钩子 / 重启]
```

---

## 3. 组件

| 部分 | 作用 |
|------|------|
| **sw-description** | 声明 version、镜像文件名、目标 device、压缩类型、脚本钩子 |
| **swupdate** | 守护进程或一次性工具：解析、验签、执行 |
| **cpio .swu** | 描述文件 + 镜像 payload 打成的归档 |
| **第三方 handler** | raw、ubivol、bootloader、lua/shell 钩子等 |

配置语法基于 **libconfig** 风格（注意逗号与括号）。

---

## 4. 最小 sw-description 思路

```text
software = {
  version = "1.0.0";
  images = (
    {
      filename = "rootfs.ext4.gz";
      device = "/dev/mmcblk0p3";
      type = "raw";
      compressed = "zlib";
    }
  );
};
```

必须与真实分区一致：

- `device` 节点是否存在、是否为 **inactive** 槽；  
- 压缩格式与打包时一致；  
- 若升级 kernel/DTB，常另有 `files` 或 boot 分区条目（视方案）。

打包（示意）：

```bash
# 具体工具链以 swupdate 文档 / meta-swupdate 为准
# 得到含 sw-description 与 payload 的 .swu
```

板上：

```bash
swupdate -i /path/to/update.swu
# 或启用 web/IPC 接口由上位机推送
```

---

## 5. 与 A/B

推荐流程：

1. 确定当前启动 slot（如 `bootslot` / `rauc` 状态文件——以你 BSP 为准）。  
2. swupdate **只写另一槽** 的 rootfs/kernel。  
3. 成功后调用 **bootloader 环境变量/脚本** 切换下次启动槽。  
4. 新槽启动失败 → bootloader 回退旧槽（硬件/脚本需支持）。  

详见 [[A-B 分区与回滚策略]]；勿在未验证回滚前对唯一 rootfs 做破坏性试验。

---

## 6. 签名

- 使用 **CMS（Cryptographic Message Syntax）** 对 `.swu` 签名。  
- 设备端持有 **公钥**（只读分区、recovery、或安全存储）；私钥留在 CI/HSM。  
- 与 **Secure Boot / module signing** 分层：OTA 签的是升级包；Secure Boot 签的是启动链镜像。见 [[TrustZone 与安全启动概念]]、[[内核模块签名机制]]。

未签名包仅用于实验室；量产应 **拒绝** 验签失败的包。

---

## 7. 实践清单

- [ ] Buildroot：`BR2_PACKAGE_SWUPDATE`（及签名相关依赖）或 Yocto `swupdate` recipe  
- [ ] 准备与板子分区一致的 `sw-description`  
- [ ] 打出 `.swu`，在 **可恢复环境** 首次试升级  
- [ ] 打开验签后再测一次「篡改包被拒」  
- [ ] 若 A/B：验证失败槽回滚  

排障：提高 swupdate 日志级别；确认电源稳定（升级中掉电是变砖常见原因）；确认写入的是预期 `device`。

---

## 8. 延伸阅读

- [[linux/OTA/A-B 分区与回滚策略]]  
- [[linux/OTA/Mender 入门]]（另一产品化方案对照）  
- [[linux/学习路径/最小可启动工程指南]]  
- [[linux/OTA/远程日志与最小可观测]]  
- 上游：https://sbabic.github.io/swupdate/
