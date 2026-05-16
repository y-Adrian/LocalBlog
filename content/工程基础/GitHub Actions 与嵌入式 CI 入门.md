---
tags:
  - 工程基础
  - CI
title: GitHub Actions 与嵌入式 CI 入门
description: 构建校验、静态分析与制品归档
date: 2026/05/16
---

# GitHub Actions 与嵌入式 CI 入门

本文对应 [[成长路径/index|成长路径]] **工程基础**：用 **GitHub Actions** 做提交级 **编译检查**（镜像制品可选）。

---

## 最小 workflow

`.github/workflows/build.yml`：

```yaml
name: build
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install deps
        run: sudo apt-get update && sudo apt-get install -y gcc-aarch64-linux-gnu cppcheck
      - name: Cross build
        run: make CROSS_COMPILE=aarch64-linux-gnu-
      - name: cppcheck
        run: cppcheck --error-exitcode=1 -Iinclude src/
```

---

## 分层策略

| 层级 | 内容 | 频率 |
|------|------|------|
| 快 | 语法编译、单元测试 | 每次 PR |
| 中 | clang-tidy、镜像尺寸检查 | 每日 / main |
| 慢 | 完整 Buildroot 镜像 | 发布 tag |

完整镜像耗时长，可用 **self-hosted runner** 或 **仅 release** 触发。

---

## 制品

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: firmware
          path: output/images/*
```

固件 **不要** 提交 git；用 **Release + artifact** 分发。

---

## 密钥

- 签名密钥放 **GitHub Secrets**。
- 勿在 log 打印 token。

---

## 延伸阅读

- [[工程基础/静态分析入门]]
- [[linux/学习路径/最小可启动工程指南]]
