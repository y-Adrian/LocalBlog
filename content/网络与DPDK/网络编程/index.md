---
date: 2026/05/21
title: Linux 网络编程
description: 用户态 Socket、TCP/UDP、IO 多路复用与并发服务器模型
---

# Linux 网络编程

本目录补全 **用户态网络编程** 知识点，与 [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界|内核网络栈]]、[[网络与DPDK/教程/index|DPDK 教程]] 形成对照：

| 层次 | 目录 | 关注点 |
|------|------|--------|
| 内核路径 | [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]] | socket → 协议栈 → 驱动 |
| **用户态 socket** | **本目录** | `socket` API、TCP/UDP、epoll |
| 用户态旁路 | [[网络与DPDK/教程/index]] | mbuf、PMD、poll 模式 |
| 分布式接口 | [[网络与DPDK/实践/RPC 技术与分层详解]] | gRPC、序列化、传输；元数据见 [[分布式系统/共识算法/index]] |

## 学习顺序

1. [[Socket 编程基础：TCP、UDP 与字节序]] — API、地址结构、最小客户端/服务端
2. [[IO 多路复用：select、poll、epoll 与并发模型]] — 高并发服务器骨架
3. [[TCP 连接、粘包与常见陷阱]] — 三次握手、状态、粘包、调试

## 与站内其他笔记

- 绑核、延迟：[[linux/内核机制/进程调度与绑核]]、[[网络与DPDK/实践/DPDK 性能剖析与绑核 checklist]]
- Go 并发：[[编程语言/Go/goroutine 与 channel 并发模型]]
- C++ 多线程服务端：[[编程语言/C++/C++多线程与多进程编程]]
- 排障：`tcpdump`、`ss` — [[系统调试/排障工具链一张图]]
