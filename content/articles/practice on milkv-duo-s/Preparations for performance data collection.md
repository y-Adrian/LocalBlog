---
contentType: article
date: 2026/10/25
showArticleMeta: true
---
## 0.1 perf tools

There are no perf tools in my `milkv-duos-musl-riscv64-sd.img` by default. So here I compile it:
```bash
# build perf
cd ~/pocket/duo-sdk
source build/cvisetup.sh          # 让 riscv64-unknown-linux-musl-gcc 进入 PATH
which riscv64-unknown-linux-musl-gcc

mkdir -p /tmp/perf-build
cd linux_5.10
make -C tools/perf O=/tmp/perf-build ARCH=riscv \
  CROSS_COMPILE=riscv64-unknown-linux-musl- \
  LDFLAGS=-static WERROR=0 \
  NO_LIBELF=1 NO_LIBUNWIND=1 NO_LIBBPF=1 NO_BACKTRACE=1 \
  NO_LIBPYTHON=1 NO_LIBPERL=1 NO_SLANG=1 NO_GTK2=1 NO_LIBNUMA=1 \
  NO_LIBAUDIT=1 NO_LIBCRYPTO=1 NO_ZLIB=1 NO_LZMA=1 NO_DEMANGLE=1 \
  NO_SDT=1 NO_JVMTI=1 NO_LIBBABELTRACE=1 NO_LIBCAP=1

file /tmp/perf-build/perf

# tranfer it to my board
[root@milkv-duo]/mnt/tpu/tpu-sdk# perf --version
perf version 5.10.4
```

## 0.2 read 