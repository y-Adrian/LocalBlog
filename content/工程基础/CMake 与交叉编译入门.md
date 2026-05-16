---
tags:
  - 工程基础
  - CMake
title: CMake 与交叉编译入门
description: 库工程、toolchain 文件与 install 前缀
date: 2026/05/16
---

# CMake 与交叉编译入门

本文对应 [[成长路径/index|成长路径]] **工程基础 · 中优先级**：用 **CMake** 组织嵌入式用户态工程并配置 **交叉 toolchain**。

---

## 最小工程

```cmake
cmake_minimum_required(VERSION 3.16)
project(demo C)
add_executable(demo main.c)
```

```bash
mkdir build && cd build
cmake ..
make
```

---

## toolchain 文件

`aarch64-linux-gnu.cmake`：

```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_FIND_ROOT_PATH /path/to/sysroot)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

使用：

```bash
cmake -DCMAKE_TOOLCHAIN_FILE=../aarch64-linux-gnu.cmake ..
```

---

## 与 Buildroot / Yocto

- Buildroot 可导出 **SDK** 含 toolchain 与 sysroot。
- 应用工程 **不拷贝** 整个 rootfs，只链接 SDK 中库。

---

## 常用实践

| 项 | 建议 |
|----|------|
| 依赖 | `find_package` + 安装到 sysroot |
| 安装 | `cmake --install` 到 `DESTDIR` 打包 |
| 选项 | `-DCMAKE_BUILD_TYPE=Release` |

Meson 思路类似（`cross file`），按团队选型即可。

---

## 延伸阅读

- [[linux/学习路径/应用交叉编译实战指南]]
- [[linux/平台与构建/嵌入式场景下的交叉编译]]
