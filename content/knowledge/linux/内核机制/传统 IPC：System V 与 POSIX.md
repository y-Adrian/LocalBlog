---
tags:
  - Linux
  - IPC
  - 进程
title: 传统 IPC：System V 与 POSIX
description: 管道、消息队列、信号量、共享内存；两套 API 对比与选型
date: 2026/05/26
aliases:
  - "linux/内核机制/传统 IPC：System V 与 POSIX"
  - "articles/linux/内核机制/传统 IPC：System V 与 POSIX"
contentType: knowledge
showArticleMeta: true
modified: 2026-10-12
---
# 传统 IPC：System V 与 POSIX

**IPC（Inter-Process Communication，进程间通信）** 让 **独立地址空间** 的进程交换数据、同步。Linux 上除 **Socket** 外，「传统 IPC」主要指 **管道** 以及 **System V IPC**、**POSIX IPC** 两套内核接口。

---

## 1. 读完能带走什么

- 能画 **管道 → 消息队列 / 共享内存 + 信号量** 的分工。  
- 区分 **System V**（`ftok` + `msgget`/`semget`/`shmget`）与 **POSIX**（`mq_open`/`sem_open`/`shm_open`）。  
- 根据消息边界、同步方式、生命周期和部署限制选机制，不按“新旧”或单次延迟排名。

---

## 2. 为什么需要 IPC

```mermaid
flowchart LR
  subgraph P1["进程 A"]
    VA1[独立虚拟地址空间]
  end
  subgraph P2["进程 B"]
    VA2[独立虚拟地址空间]
  end
  VA1 -->|不能直接写对方内存| IPC[IPC 机制]
  IPC --> VA2
```

| 场景 | 典型 IPC |
|------|----------|
| 父子 / 兄弟进程传字节流 | **pipe**、**FIFO** |
| 结构化消息、多读者 | **消息队列** |
| 大块数据、低延迟 | **共享内存** + **信号量** |
| 跨主机 / 通用 | **Socket**（见 [[knowledge/网络与DPDK/网络编程/Socket 编程基础：TCP、UDP 与字节序]]） |

线程共享地址空间，但仍需根据共享数据访问方式选择互斥或原子协议；进程也可以映射共享内存，并使用明确配置的进程间同步对象。见 [[knowledge/编程语言/C++/C++多线程与多进程编程]]。

---

## 3. 机制总览

```mermaid
flowchart TB
  NEED[通信需求] --> STREAM[字节流]
  NEED --> MESSAGE[消息边界]
  NEED --> MEMORY[共享数据布局]
  STREAM --> PIPE[pipe / FIFO / 流式 Socket]
  MESSAGE --> QUEUE[消息队列 / 报文 Socket]
  MEMORY --> SHM[共享内存]
  SHM --> SYNC[同步 + 通知 + 生命周期协议]
```

| 机制 | 数据形态 | 内核拷贝 | 典型同步 |
|------|----------|----------|----------|
| **pipe / FIFO** | 字节流 | 是 | 阻塞读写 |
| **消息队列** | 离散消息 | 是 | 队列满/空阻塞 |
| **共享内存** | 任意结构 | **否**（映射同物理页） | **信号量** / mutex（`pthread` in shm） |
| **信号量** | 仅计数 | — | P/V 操作 |
| **Socket** | 字节流 / 报文 | 是 | poll/epoll |

---

## 4. 管道（pipe）与命名管道（FIFO）

### 4.1 匿名管道 `pipe`

- **单向**字节流；**亲缘进程**（fork 后）最常用。  
- `pipefd[0]` 读端，`pipefd[1]` 写端；**半双工**。

```c
#include <unistd.h>

int pipefd[2];
pipe(pipefd);
if (fork() == 0) {
    close(pipefd[1]);
    read(pipefd[0], buf, sizeof(buf));
    close(pipefd[0]);
} else {
    close(pipefd[0]);
    write(pipefd[1], "hello", 5);
    close(pipefd[1]);
}
```

### 4.2 命名管道 FIFO

- 路径在文件系统（如 `/tmp/myfifo`），**无亲缘关系** 的进程可通信。  
- `mkfifo(path, mode)` → 一端 `open(O_RDONLY)`，一端 `open(O_WRONLY)`。

| 对比 | pipe | FIFO |
|------|------|------|
| 标识 | fd | 路径名 |
| 范围 | 通常父子 | 任意本机进程 |
| 方向 | 单向 | 单向 |

---

## 5. System V IPC

System V IPC 用 **`key_t`（键）** 标识对象，常由 `ftok(path, id)` 从路径生成；通过 **`msgget` / `semget` / `shmget`** 创建或打开，用 **`ipcs` / `ipcrm`** 管理。

```mermaid
flowchart LR
  PATH[文件路径] --> FTOK[ftok]
  FTOK --> KEY[key_t]
  KEY --> GET[msgget / semget / shmget]
  GET --> OBJ[内核 IPC 对象]
```

### 5.1 消息队列（Message Queue）

- 内核维护 **消息链表**；每条消息有 **类型（long mtype）** 与正文。  
- `msgsnd` / `msgrcv`；可按类型选择性接收。

```c
#include <sys/msg.h>

struct msgbuf {
    long mtype;
    char mtext[256];
};

int msqid = msgget(key, IPC_CREAT | 0666);
struct msgbuf msg = { .mtype = 1, .mtext = "hi" };
msgsnd(msqid, &msg, strlen(msg.mtext) + 1, 0);
```

**特点**：带消息边界，`mtype` 用于接收选择，不等同于 POSIX 队列的数值优先级；**数据要拷贝进内核**。`msgsnd()` 的长度只包含正文，不包含 `long mtype`。

### 5.2 信号量（Semaphore）

- **计数器**，用于 **同步** 与 **互斥**（需设计成互斥用法）。  
- **System V 信号量** 常以 **数组** 形式：`semget` 一次创建多个 sem。  
- `semop` 做 **P/V**（`sem_op` 结构）；`SEM_UNDO` 可在进程退出时回滚。

```c
#include <sys/sem.h>

union semun { int val; struct semid_ds *buf; unsigned short *array; };
int semid = semget(key, 1, IPC_CREAT | 0666);
union semun arg = { .val = 1 };
semctl(semid, 0, SETVAL, arg); /* 仅创建者初始化；使用者不能重复重置 */

struct sembuf op = { 0, -1, 0 };  /* P */
semop(semid, &op, 1);
/* 临界区 */
op.sem_op = 1;                     /* V */
semop(semid, &op, 1);
```

常与共享内存配对：shm 负责数据，sem 负责同步。上面的代码是接口片段，不是多进程初始化协议；`SEM_UNDO` 也不修复已经写了一半的共享数据。

### 5.3 共享内存（Shared Memory）

- 两进程映射共享对象的相同页面，可以避免每条消息经 IPC 系统调用复制载荷；实际延迟仍受同步、缓存一致性、缺页和通知方式影响，不能一概称为“最快”。
- `shmget` → `shmat` 挂接 → 使用 → `shmdt` 分离 → `shmctl(IPC_RMID)` 删除段。

```c
#include <sys/shm.h>

int shmid = shmget(key, 4096, IPC_CREAT | 0666);
void *addr = shmat(shmid, NULL, 0);
/* 读写 addr */
shmdt(addr);
```

**注意**：共享内存 **不提供内置互斥**，必须配 **信号量 / 文件锁 / 原子变量**。

---

## 6. POSIX IPC

POSIX IPC 用 **名字**（类似路径，消息队列挂载在 `/dev/mqueue/`，共享内存对象在 `/dev/shm/` 下）和 **文件描述符** 风格 API，接口按对象类型区分：`shm_open()` 返回 fd，`mq_open()` 返回 `mqd_t`，`sem_open()` 返回 `sem_t *`，不能全部当作普通 fd 操作。

| System V | POSIX | 打开 | 删除 |
|----------|-------|------|------|
| `msgget` | `mq_open` | 名字 + `O_CREAT` | `mq_unlink` |
| `semget` + `semop` | `sem_open` + `sem_wait`/`sem_post` | 名字 | `sem_unlink` |
| `shmget` + `shmat` | `shm_open` + `mmap` | 名字 | `shm_unlink` |

### 6.1 POSIX 消息队列

创建时明确设定 `mq_maxmsg` 与 `mq_msgsize`，并检查 `mq_open()` 是否返回 `(mqd_t)-1`。打开已存在的队列时，创建属性不会重新配置它，应调用 `mq_getattr()` 取得实际 `mq_msgsize`，分配不小于该值的接收缓冲区。

即使实际消息只有 3 字节，64 字节的缓冲区也可能因队列的 `mq_msgsize` 大于 64 而得到 `EMSGSIZE`。返回长度是消息实际长度，不能假设结果自带字符串终止符。详见 [mq_receive 接收条件](https://man7.org/linux/man-pages/man3/mq_receive.3.html)。

- 支持 **优先级**、**异步通知**（`mq_notify`）。通知注册不是永久订阅，消费者要处理重新注册和队列排空之间的时序。见 [POSIX 消息队列总览](https://man7.org/linux/man-pages/man7/mq_overview.7.html)。

### 6.2 POSIX 信号量

```c
#include <semaphore.h>

sem_t *sem = sem_open("/mysem", O_CREAT, 0666, 1);
sem_wait(sem);
/* 临界区 */
sem_post(sem);
sem_close(sem);
```

- 无名信号量用于进程间同步时，必须放在共享映射内，并使用 `sem_init(sem, 非零pshared, 初值)`；放在私有堆或栈中不能让独立进程共享同一对象。
- 信号量记录计数，不记录“谁持有锁”。进程等待成功后异常退出，不会自动归还计数；`sem_close()` 也不是 `sem_post()`。见 [POSIX 信号量生命周期](https://man7.org/linux/man-pages/man7/sem_overview.7.html)。

### 6.3 POSIX 共享内存

操作顺序是 `shm_open()` → 创建者 `ftruncate()` → `mmap(..., MAP_SHARED, ...)` → 初始化与同步 → `munmap()`；谁执行 `shm_unlink()` 由协议确定。每步都要检查失败，`mmap()` 的失败值是 `MAP_FAILED`，不是 `NULL`。

`close(fd)` 不会撤销已建立的映射；`shm_unlink()` 删除名字，也不立即撤销其他进程持有的映射。独立进程初始化、布局设计与崩溃恢复见 [[knowledge/linux/内核机制/POSIX 共享内存：初始化、同步与生命周期]]。

- 新对象初始长度为 0；未完成扩容就让其他进程访问映射，可能触发 `SIGBUS`。不能把“名字已经存在”视为“数据结构已经就绪”。见 [shm_open](https://man7.org/linux/man-pages/man3/shm_open.3.html)。

---

## 7. System V vs POSIX 怎么选

| 维度 | System V | POSIX |
|------|----------|-------|
| 历史 | 更老，大量旧代码 / 教材 | 新标准，API 一致 |
| 命名 | 数字 id + `key` | 字符串名字 |
| 共享内存 | `shmat` | `shm_open` + `mmap` |
| 信号量 | 数组、`semop` 复杂 | `sem_wait/post` 直观 |
| 可移植性 | Unix 常见 | POSIX 兼容系统 |
| 选型依据 | 遗留互操作、消息类型选择、多信号量原子操作 | 命名对象、优先级队列、共享映射配套 |

**实践建议**：

- 简单父子通信 → **pipe**。  
- 无关进程、单向流 → **FIFO** 或 **Unix Domain Socket**。  
- 大数据低延迟 → **POSIX shm + sem**（或 mmap 文件）。  
- 跨机器 → **Socket**；高性能本机可考虑 **memfd + mmap**、**D-Bus**、**gRPC** 等。  
- 先核对目标系统支持、进程关系和运维方式；需要 System V 特定语义时可以选它，不以接口年代判定可用性。

---

## 8. 与内核视角的对应

| 用户 API | 内核侧（直觉） |
|----------|----------------|
| pipe | 内核缓冲区 + vfs |
| msgget | 消息链表 + 拷贝 |
| shmget / shm_open | shmem / tmpfs 文件 + 页表映射 |
| semget | System V 信号量集合与等待语义 |
| sem_open | POSIX 信号量；Linux 实现结合共享状态与 futex 等待 |

调试：

```bash
ipcs          # System V 对象
ipcs -m -s -q
ls /dev/shm   # POSIX 共享内存常见挂载
```

权限、**RLIMIT**、`/proc/sys/kernel` 下部分参数会影响队列长度、shm 上限。

---

## 9. 常见坑

| 坑 | 说明 |
|----|------|
| shm 无锁 | 必须自备同步，否则数据竞争 |
| 忘记 `close` / `IPC_RMID` | 泄漏内核对象；`ipcrm` 清理 |
| pipe 写端未关导致 **EOF 不来** | 读端一直阻塞 |
| `ftok` 碰撞 | 不同项目同 path+id 可能冲突 |
| System V sem **不是** pthread mutex | API 与语义不同，勿混用 |
| 队列容量与消息大小 | 非阻塞发送遇队列满通常为 `EAGAIN`；消息或接收缓冲区尺寸错误要区分 `EINVAL` / `EMSGSIZE` 等接口错误 |

---

## 10. 面试口述（30 秒）

> Linux 传统 IPC 有管道、System V 和 POSIX 三套。管道适合字节流；消息队列传带类型消息；共享内存减少载荷复制，但必须另外设计同步和通知。System V 用 key 和 msgget/shmget/semget；POSIX 用名字和 mq_open/shm_open/sem_open，接口更现代。选型要看数据形态、等待方式、生命周期和目标平台，而不是只看 API 年代。

---

## 11. 检查清单

- [ ] 能说出 pipe vs FIFO vs socket 的适用边界  
- [ ] 能解释共享内存为什么必须额外同步  
- [ ] 能列举 System V 与 POSIX 各三个 API  
- [ ] 知道用 `ipcs` 排查遗留 IPC 对象  

---

## 延伸阅读

- [[knowledge/linux/内核机制/进程调度与绑核]]
- [[knowledge/linux/内核机制/内核同步机制总览]]
- [[knowledge/linux/内核机制/深入了解上下文切换]]
- [[knowledge/编程语言/C++/C++多线程与多进程编程#1.3.2 进程间通信（IPC）]]
- [[knowledge/网络与DPDK/网络编程/Socket 编程基础：TCP、UDP 与字节序]]
