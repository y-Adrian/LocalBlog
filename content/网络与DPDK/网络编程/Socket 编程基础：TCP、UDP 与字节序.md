---
tags:
  - 网络编程
  - socket
  - TCP
  - UDP
title: Socket 编程基础：TCP、UDP 与字节序
description: BSD socket API、sockaddr、字节序与最小 TCP/UDP 示例
date: 2026/05/16
---

# Socket 编程基础：TCP、UDP 与字节序

本文是 [[网络与DPDK/网络编程/index|Linux 网络编程]] 第一篇：在 **用户态** 通过 **BSD Socket API** 使用内核协议栈（与 DPDK 旁路相对）。读完后应能写出可运行的 **TCP 回显服务端/客户端** 和 **UDP 报文收发**。

---

## 1. 从内核栈到 socket

应用调用 `socket()` 时，内核创建 `struct socket` 并与 **协议族**（如 `AF_INET`）、**类型**（`SOCK_STREAM` / `SOCK_DGRAM`）绑定。数据路径见 [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]。

```
应用  read/write/send/recv
  → 系统调用
  → 内核 socket 层 → TCP/UDP → IP → 驱动
```

**文件描述符**：`socket()` 返回的 fd 与文件一样可用 `read`/`write`（TCP 常用 `send`/`recv` 语义更清晰）。

---

## 2. 核心 API 一览

| API | 作用 |
|-----|------|
| `socket()` | 创建套接字 |
| `bind()` | 绑定本地 IP/端口 |
| `listen()` | TCP 监听（仅服务端） |
| `accept()` | 接受新连接，返回 **已连接** fd |
| `connect()` | TCP 客户端发起连接 |
| `send()` / `recv()` | TCP 收发（注意返回值与部分读写） |
| `sendto()` / `recvfrom()` | UDP 收发，带对端地址 |
| `close()` | 关闭；`shutdown()` 半关闭 |
| `setsockopt()` | `SO_REUSEADDR`、`TCP_NODELAY` 等 |

UDP 无连接：**不需要** `listen`/`accept`/`connect`（也可用 `connect` 固定对端）。

---

## 3. 地址结构与字节序

### 3.1 `sockaddr_in`（IPv4）

```c
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>

struct sockaddr_in addr;
memset(&addr, 0, sizeof(addr));
addr.sin_family = AF_INET;
addr.sin_port = htons(8080);              /* 网络字节序 */
inet_pton(AF_INET, "0.0.0.0", &addr.sin_addr);
```

- **端口与多字节整数** 必须用 `htons` / `htonl`（host → network）；读回用 `ntohs` / `ntohl`。
- **点分十进制 IP** 推荐 `inet_pton` / `inet_ntop`（线程安全），避免过时 `inet_addr`。
- `bind` / `connect` 参数类型为 `struct sockaddr *`，需强制转换。

### 3.2 通配与回环

| 地址 | 含义 |
|------|------|
| `0.0.0.0` | 监听所有网卡 |
| `127.0.0.1` | 本机回环 |
| 具体 IP | 只绑定该接口 |

嵌入式设备上注意：**只监听管理网口** 可减少暴露面。

---

## 4. 最小 TCP 服务端（阻塞）

```c
int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
/* bind + listen，略 */
for (;;) {
    int conn = accept(listen_fd, NULL, NULL);
    if (conn < 0) continue;
    char buf[4096];
    ssize_t n;
    while ((n = recv(conn, buf, sizeof(buf), 0)) > 0)
        send(conn, buf, n, 0);   /* echo */
    close(conn);
}
```

要点：

- `accept` 返回 **新 fd**，原 `listen_fd` 继续监听。
- `recv` 返回 `0` 表示对端 **正常关闭**（FIN）。
- `send` 返回值可能 `<` 请求长度，生产代码需 **循环发送**。

### 4.1 最小 TCP 客户端

```c
int fd = socket(AF_INET, SOCK_STREAM, 0);
/* connect 到 server */
send(fd, msg, len, 0);
recv(fd, buf, sizeof(buf), 0);
close(fd);
```

---

## 5. 常用 `setsockopt`

```c
int on = 1;
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on));
```

| 选项 | 场景 |
|------|------|
| `SO_REUSEADDR` | 重启服务时避免 `TIME_WAIT` 导致 `bind` 失败 |
| `SO_REUSEPORT`（Linux） | 多进程/线程同端口负载分担 |
| `TCP_NODELAY` | 关闭 Nagle，降低小报文交互延迟 |
| `SO_RCVTIMEO` / `SO_SNDTIMEO` | 收发超时 |

---

## 6. UDP 示例要点

```c
int fd = socket(AF_INET, SOCK_DGRAM, 0);
/* bind 本地端口（服务端） */
ssize_t n = recvfrom(fd, buf, sizeof(buf), 0,
                     (struct sockaddr *)&peer, &peer_len);
sendto(fd, buf, n, 0, (struct sockaddr *)&peer, peer_len);
```

- **无连接**：每个 `recvfrom` 可来自不同对端。
- **报文边界**：一次 `sendto` 对应一次 `recvfrom`（≤ MTU 时），**没有 TCP 粘包问题**。
- 适合：发现协议、telemetry、局域网广播（需 `SO_BROADCAST`）。

---

## 7. 阻塞 vs 非阻塞

| 模式 | 行为 |
|------|------|
| **默认阻塞** | `accept`/`recv` 无数据时线程睡眠 |
| **非阻塞** | `fcntl(O_NONBLOCK)`，`EAGAIN` 表示暂无可读 |

单线程阻塞模型只适合 **少量连接**；高并发见 [[IO 多路复用：select、poll、epoll 与并发模型]]。

---

## 8. 与 DPDK / RPC 的边界

| 技术 | 层次 |
|------|------|
| 本文 Socket | 内核 TCP/UDP，通用业务 |
| [[网络与DPDK/教程/index]] | 用户态直接收发包，常自建 L3/L4 |
| [[网络与DPDK/实践/RPC 技术与分层详解]] | 建立在 TCP/HTTP/2 之上的远程调用 |

**控制面**（配置、OTA、RPC）多用 Socket；**线速转发** 才考虑 DPDK。

---

## 9. 调试命令

```bash
ss -lntp                    # 监听端口与进程
tcpdump -i any port 8080    # 抓包
nc -vz 127.0.0.0 8080       # 探测端口
```

更多工具见 [[系统调试/排障工具链一张图]]。

---

## 延伸阅读

- [[IO 多路复用：select、poll、epoll 与并发模型]]
- [[TCP 连接、粘包与常见陷阱]]
- [[linux/内核机制/Linux 内核网络栈与 DPDK 适用边界]]
