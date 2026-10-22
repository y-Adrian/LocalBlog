---
title: Duo S zero copy data path
showArticleMeta: true
date: 2026/10/22
---

[Run YOLOv5 object detection on Milk-V Duo S](Run%20YOLOv5%20object%20detection%20on%20Milk-V%20Duo%20S.md)

## 0.1 Board information(RISC-V)
```bash
[root@milkv-duo]~# uname -m  
riscv64  
[root@milkv-duo]~# cat /proc/cpuinfo | head -20  
processor : 0  
hart : 0  
isa : rv64imafdvcsu  
mmu : sv39

[root@milkv-duo]~# which perf  
[root@milkv-duo]~# ls /sys/kernel/debug/tracing 2>/dev/null | head  
[root@milkv-duo]~# zcat /proc/config.gz 2>/dev/null | grep -E "PERF_EVENTS|FTRACE|DEBUG_FS"  
CONFIG_HAVE_PERF_EVENTS=y

# CONFIG_PERF_EVENTS is not set

CONFIG_HAVE_KPROBES_ON_FTRACE=y  
CONFIG_BLK_DEBUG_FS=y

# CONFIG_USB_GADGET_DEBUG_FS is not set

CONFIG_DEBUG_FS=y  
CONFIG_DEBUG_FS_ALLOW_ALL=y

# CONFIG_DEBUG_FS_DISALLOW_MOUNT is not set

# CONFIG_DEBUG_FS_ALLOW_NONE is not set

CONFIG_HAVE_DYNAMIC_FTRACE=y  
CONFIG_HAVE_DYNAMIC_FTRACE_WITH_REGS=y  
CONFIG_HAVE_FTRACE_MCOUNT_RECORD=y

# CONFIG_FTRACE is not set

[root@milkv-duo]/mnt/tpu/tpu-sdk# file ./samples/samples_extra/bin/cvi_sample_detector_yolo_v5_fused_preprocess  
./samples/samples_extra/bin/cvi_sample_detector_yolo_v5_fused_preprocess: ELF 64-bit LSB executable, UCB RISC-V, RVC, double-float ABI, version 1 (SYSV), dynamically linked, interpreter /lib/ld-musl-riscv64v0p7_xthead.so.1, with debug_info, not stripped

[root@milkv-duo]/mnt/tpu/tpu-sdk# cat /proc/meminfo | head -5  
MemTotal: 323144 kB  
MemFree: 168060 kB  
MemAvailable: 286024 kB  
Buffers: 5836 kB  
Cached: 89616 kB
```
