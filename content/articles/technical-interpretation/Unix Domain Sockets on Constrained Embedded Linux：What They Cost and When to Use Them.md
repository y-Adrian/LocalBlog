---
date: 2026/10/20
contentType: article
showArticleMeta: true
tags:
  - socket
  - IPC
---
Unix domain sockets are the default answer to "how should two processes talk?" on Linux, and for good reason: the API is familiar, the semantics are well defined, and the kernel does the hard parts. On a server, that answer is rarely wrong. On a mid-range embedded SoC -- a few modest cores, a few hundred megabytes of RAM, and a memory bus shared with ISP and an NPU -- the same answer can quietly become the bottleneck.

This article explains how `AF_UNIX` sockets work, what they are genuinely good at, and where their costs start to matter on constrained hardware. It closes with a pattern that keeps their strengths and avoids their weakness.

## 1. What a Unix domain socket is

An `AF_UNIX` socket provides communication between processes on the same host, inside the same kernel. It uses the ordinary socket calls (`socket`,`bind`,`listen`,`accept`,`connect`,`send`,`recv`), but nothing passes through the network stack. There are no IP or TCP headers, no routing, no checksums, no congestion control. The kernel simply moves a buffer from one socket to its peer.

That last sentence hides the property that matters most for the rest of this article: **The kernel moves the data by copying it.** A `send()` allocates an `sk_buff`, copies the user buffer into it, and queues it on the peer's receive queue. The peer's `recv()` copies it back out into user space. One transfer there costs two copies, two system calls and typically a sleep and wakeup on the receiving side.

Compared with TCP over the loopback interface, this is substantially cheaper, because the entire protocol layer is skipped. Compared with shared memory, it is substantially more expensive, because shared memory involves no copy and, on the fast path, no system call.

## 2. Addresses and socket types

### Addressing

`unix(7)` describes three ways a socket can be named:
- **Pathname sockets** are bound to a filesystem path such as `/run/app/ctl.lock`. Binding creates a socket-type inode. Access is governed by ordinary file permissions(connecting requires write permission on the file and search permission on its directories), and by any Linux Security Module in play. The inode is **not** removed when the socket is closed, so a crashed server leaves it behind and the next `bind()` fails with `EADDRINUSE` unless the path is unlinked first.
- **Abstract sockets** are a Linux extension. If the first byte of `sun_path` is a null byte, the name lives in a kernel namespace rather than the filesystem. There is nothing to clean up, but there are also no file permissions, and the name is scoped to the network namespace rather than the mount namespace.
- **Unnamed sockets** come from `sockerpair(2)` and are the natural choice between a parent and its children.

`sun_path` is limited to 108 bytes, which is occasionally relevant on build systems that generate deeply nested paths.

### Socket types
| Type             | Message boundaries | Notes                                                                                                                                     |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SOCK_STREAM`    | No                 | A byte stream; the application must frame messages itself                                                                                 |
| `SOCK_DGRAM`     | Yes                | Unlike UDP, delivery over `AF_UNIX` is reliable and ordered. A full receive queue blocks the sender(or returns `EAGAIN` if non-blocking). |
| `SOCK_SEQPACKET` | Yes                | Connection-oriented, with record boundaries preserved.                                                                                    |

For control protocols, `SOCK_SEQPACKET` is usually the best fit. It gives you connection semantics, so you learn when a peer disappears, and it hands you whole messages, so there is no framing code to get wrong. The maximum message size is bounded by the socket's send buffer, and an undersized receive buffer causes the excess to be discarded (flagged with `MSG_TRUNC`), so size buffers deliberately.

## 3. Two things TCP cannot do 
Most of the reason to choose `AF_UNIX` over loopback TCP, beyond speed, comes down to two features that only make sense when both ends share a kernel.

### Authenticated peers

Over a connected UNIX socket, the kernel can tell you who is on the other hand. `SO_PEERCRED` returns the PID, UID, and GID of the peer as recorded when the connection was established, and the peer cannot forge them.

```c
struct ucred cred;
socklen_t len = sizeof(cred);
if (getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &cred, &len) == 0) {
	/* cred.pid, cred.uid, cred.gid */
}
```

For per-message credentials there is `SCM_CREDENTIALS` (enabled with `SO_PASSCRED`), and since Linux 6.5, `SO_PEERPIDFD` returns a pidfd for the peer, which avoids the classic problem of a PID being recycled between the check and its use. For a local daemon that needs to decide whether a client may issue a command, this is far simpler than inventing a token scheme over TCP.

### Passing file descriptors

The `SCM_RIGHTS` control message transfers open file descriptors between processes. The receiver gets a new descriptor referring to the same open file description. A single message can carry up to 253 descriptors (see `unix(7)` and `cmsg(3)`).

What can be passed is anything that is a file descriptor: regular files, pipes, sockets, `eventfd`s, `memfd`s, and `dma-buf` handles. This is the property that makes UNIX sockets an excellent **companion** to shared memory, as discussed in Section 6.

```c
static int send_fd(int sock, int fd, const void *meta, size_t meta_len)
{
	struct iovec iov = { .iov_base = (void *)meta, .iov_len = meta_len };
	char ctrl[CMSG_SPACE(sizeof(int))] = { 0 };
	struct msghdr msg = {
		.msg_iov = &iov,
		.msg_iovlen = 1,
		.msg_control = ctrl,
		.msg_controllen = sizeof(ctrl)
	};
	
	struct cmsghdr *cm = CMSG_FIRSTHDR(&msg);
	
	cm->cmsg_level = SOL_SOCKET;
	cm->cmsg_type = SCM_RIGHTS;
	cm->cmsg_len = CMSG_LEN(sizeof(int));
	memcpy(CMSG_DATA(cm), &fd, sizeof(int));
	
	return sendmsg(sock, &msg, 0);
}
```

Note that at least one byte of ordinary data must accompany the control message on a stream socket, which is why the helper carries a `meta` payload.

## 4. General strengths and weakness

On the plus side, `AF_UNIX` sockets are fast enough for most control traffic, integrate with `epoll` and every existing event loop, come with kernel-verified peer identity, and need no network configuration, Because they are not reachable from outside the host, they also shrink the attack surface relative to a loopback listener that any local process (or a misconfigured firewall rule) might expose.

The weaknesses follow from the design:
- **Every byte is copied twice**, and every message pays for system calls and a scheduler wakeup.
- **There is no multicast.** Delivering the same message to N consumers means N sends and N copies.
- **Flow control is whether the socket buffers give you.** A slow consumer eventually stalls the producer, so the application needs its own policy for dropping, coalescing, or timing out.
- **Pathname sockets outlive their creators**, which means startup code must unlink stale files.
- **Memory accounting is indirect.** Queued data is charged to the sender's buffer by `skb` `truesize`, which exceeds the payload size, and the memory comes out of the kernel's slab allocator rather than from anything the application can inspect or free directly.
- **Scope is one kernel.** The mechanism does nothing for communication with another host, a different OS image, or a microcontroller core on the same die.

None of these is a flaw on a workstation. On a constrained SoC, several become first-order concerns.

## 5. What changes on constrained embedded hardware

By "Mid-range constrained" we mean roughly: one to four cores at round 1 GHz, tens to hundreds of megabytes of RAM, a single DDR channel shared between the CPU and accelerators, and a workload that includes camera or sensor streams.

### Copies compete with the accelerators for bandwidth

Consider uncompressed 1080p video in NV12. A frame is $1920 * 1080 * 1.5 ≈ 3.1MB$, so 30 frames per second is about 93MB/s of payload. Send that through UNIX socket copies roughly 186 MB/s. Because each copy is a read plus a write, the upper bound on DDR traffic is on the order of 370 MB/s (caches may absorb some of this, but frame-sized buffers rarely fit in a small L2).

On a desktop this is noise. On an SoC where the ISP, NPU, display controller, and CPU all share one memory controller, it is bandwidth taken directly from the components that produce your product's actual output. The copies also evict useful cache lines, which shows unrelated code running on the same cores.

The situation worsens with fan-out. If three consumers (say, interface, display, and recording) subscribe to the same stream, a socket-based design copies each frame three times on the send side alone. To my knowledge `AF_UNIX` has no zero-copy send path comparable to `MSG_ZEROCOPY` on TCP, so there is no flag that rescues this.

### Fixed per-message costs weigh more on slow cores

A system call plus context switch costs a certain number of microseconds on a 3 GHz server core and noticeably more on a 1 GHz in-order core. At a few thousand messages per second, the kernel path can consume a visible fraction of a CPU that is also expected to run application logic. Latency is also at the mercy of the scheduler: sockets provide no priority inheritance, and wakeup latency depends on load, so they are a poor fit for paths with hard deadlines even on a `PREEMPT_RT` kernel.

### Kernel memory is a shared, hard-to-see budget

Queued socket data lives in kernel memory. If a consumer stalls, its backlog grows until it hits the send buffer limit (`SO_SNDBUF`， defaulting to `net.core.wmen_default`), and every connection can independently hold that much. With dozens of connections on a 256 MB device, the arithmetic is uncomfortable, and because the memory is slab-allocated, a long-running system can fragment to the point where allocations start failing with `ENOBUFS` or `EAGAIN`. These failures tend to show up weeks into a soak test rather than in the first hour.

### Build, rootfs, and runtime constraints

Several practical issues comes from how embedded images are assembled:
- Minimal kernel configurations sometimes disable `CONFIG_UNIX`. It is a one-line fix, but it means a BSP rebuild.
- Pathname sockets need a writable directory. On a read-only root filesystem you need a `tmpfs` mount (usually `/run`), and after power loss or a crash you need to unlink stale sockets at startup. Abstract sockets sidestep both problems at the cost of losing file-permission checks, in which case `SO_PEERCRED` becomes your access control.
- The default `RLIMIT_NOFILE` soft limit is often 1024, and each connection costs a descriptor plus kernel state, so services with many clients must raise the limit and use `epoll`.
- Busybox builds often strip `ss` and `lsof`. `/proc/net/unix` remains available for inspecting queues.

### Heterogeneous SoCs

Many current SoCs pair Linux-capable application cores with a small RTOS core, for example the RISC-V plus ARM arrangement in some Milk-V boards, A UNIX socket cannot cross that boundary.  Communication between the two domains has to use the mailbox and rpmsg framework or an explicitly shared DDR region, so a UNIX socket solves, at best, the Linux half of the system.

## 6. A pattern that works: control plane over sockets, data plane in shared memory

The usual way out is to stop asking the socket to carry bulk data. Use it for what it is good at (connection setup, authentication, descriptor exchange, commands, notification) and let shared memory carry the payload.

```
  Producer                                                   Consumer(s)
 ┌─────────┐   UNIX socket (SEQPACKET)                      ┌─────────┐
 │ capture │ ◀─── handshake, SCM_RIGHTS, commands, ───────▶ │ infer / │
 │  / ISP  │      "frame N ready" notifications             │ display │
 └────┬────┘                                                └────┬────┘
      │                                                          │
      └───────── shared memory / dma-buf (frame data) ───────────┘
                 zero copy: producer writes, consumers map
```


A typical protocol looks like this:
1. A consumer connects. The producer verifies it with `SO_PEERCRED`.
2. The producer allocates a pool of buffers, as `memfd`s (see `memfd_create(2)`) or `dma-buf` handles from the relevant driver, and sends their descriptors to the consumer over `SCM_RIGHTS`, alone with the metadata: buffer count, size, pixel format, stride.
3. For Each frame, the producer writes into a free buffer and sends a tiny message: buffer index, sequence number, timestamp. That message is a few dozen bytes, so socket overhead is irrelevant.
4. The consumer processes the buffer in place and sends back a release message so the producer can reuse it.

Several details make this robust. With `memfd`, file sealing (`F_SEAL_SHRINK`, `F_SEAL_GROW`) lets  a consumer verify that the producer cannot truncate the mapping underneath it, which prevents `SIGBUS` surprises. Reference counts per buffer let multiple consumers share one frame without extra copies. An `eventfd`, itself passable over `SCM_RIGHTS`, can replace per-frame socket messages if the notification rate is high enough to matter. And with `dma-buf`, the same descriptor can be imported by the camera pipeline, the NPU deriver, and the display engine, so the pixels never visit the CPU at all.

The socket remains valuable throughout. It provides the lifecycle signal (a closed connection means the peer died, so reclaim its buffers) and the authenticated, ordered control channel, neither of which shared memory gives you.

## 7. Choosing a mechanism

| Mechanism                     | Data copies            | Per-message overhead   | Fan-out                | Crosses OS boundaries | Typical rile                                |
| ----------------------------- | ---------------------- | ---------------------- | ---------------------- | --------------------- | ------------------------------------------- |
| UNIX socket                   | 2                      | syscall+wakeup         | poor                   | no                    | control plane, low-to-medium rate messages  |
| pipe/FIFO                     | 2                      | syscall+wakeup         | poor                   | no                    | simple parent/child plumbing                |
| POSIX message queue           | 2                      | syscall+wakeup         | poor                   | no                    | small prioritized messages                  |
| loopback TCP/UDP              | 2                      | syscall+protocol stack | UDP only               | no                    | code that may later run over a real network |
| shared memory + futex/eventfd | 0                      | Low                    | good                   | no                    | high rate data plane                        |
| dma-buf                       | 0                      | Low                    | good                   | no                    | buffer sharing between hardware blocks      |
| rpmsg/mailbox                 | Implementation-defined | Implementation-defined | Implementation-defined | yes                   | Linux-to-RTOS communication                 |

## 8. Practical notes

- Prefer `SOCK_SEQPACKET` for protocols you design yourself. Fall back to `SOCK_STREAM` with a length prefix only when you must interoperate with something else.
- Create descriptors with `SOCK_CLOEXEC` (and use `accept4`) so the do not leak across `exec`.
- Unlink pathname sockets before `bind`, place them on `tmpfs`, and set the mode deliberately. Consider abstract sockets when the filesystem is read-only, but then enforce identity with `SO_PEERCRED`.
- Decide what a full queue means before it happens. Use `MSG_DONTWAIT` or `SO_SNDTIMEO` and choose between dropping the newest message, coalescing, or disconnecting the consumer.
- Set `SO_SNDBUF` and `SO_RCVBUF` explicitly and measure. The defaults are tuned for general-purpose systems, not for a 256MB device with thirty clients.
- Check the kernel configuration for `CONFIG_UNIX` and the process `RLIMIT_NOFILE` early in bring-up, not during integration testing.
- When something is stuck, `/proc/net/unix` and `ss -x` show queued bytes per socket, which usually identifies the slow consumer quickly.

## 9. Conclusion

Unix domain sockets are a very good control channel and a poor bulk-data channel, and the gap between those two roles widens as hardware gets smaller. The two-copy data path, the per-message system call and wakeup, the kernel-side buffering, and the one-kernel scope are all invisible on a server and all visible on a bandwidth-constrained SoC. The combination that tends to work is the one API itself suggests: let the socket establish trust and exchange descriptors, and let shared memory or `dma-buf` carry the data.

## 10. Further reading

- `unix(7)`: address formats, socket types, abstract namespace, descriptor and credential passing
- `cmsg(3)`, `sendmsg(2)`, `recvmsg(2)`: ancillary data handling
- `socket(7)`: `SO_SNDBUF`, `SO_RCVBUF`, `SO_PEERCRED`, `SO_PASSCRED`
- `credentials(7)`: how process credentials are defined and checked
- `memfd_create(2)` and `fcntl(2)` (file sealing): anonymous shared memory
- Linux kernel documentation: *dma-buf* (driver API guide), *rpmsg*, and the *mailbox* framework