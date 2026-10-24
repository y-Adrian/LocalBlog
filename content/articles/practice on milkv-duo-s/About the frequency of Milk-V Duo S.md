---
showArticleMeta: true
contentType: article
date: 2026/10/25
---
## 0.1 Background: why the frequency of my Milk-V Duo S board is 850MHz, rather than 1GHz?

I am using a **Milk-V Duo S** board with a RISC-V system on it. I want to test the performance of my program. However when I used the `perf` tool, I found that the board's frequency is not, in fact, 1GHz.

Here is one output of the terminal after I run a `perf stat ..` command.
```bash
Performance counter stats for './samples/samples_extra/bin/cvi_sample_detector_yolo_v5_fused_preprocess ./yolov5n_int8_fuse.cvimodel ./samples/samples_extra/data/dog.jpg yolov5n_out.jpg':

         338906665      cycles                    #    0.850 GHz
            398.82 msec task-clock                #    0.918 CPUs utilized
                89      context-switches          #    0.223 K/sec
                 0      cpu-migrations            #    0.000 K/sec
              3211      page-faults               #    0.008 M/sec

       0.434304200 seconds time elapsed

       0.315344000 seconds user
       0.083825000 seconds sys
```

Here is `0.850 GHz`, something feels a bit off. 
I recall that the official website stating that this board's core RISC-V CPU up to 1GHz. Is there anything wrong?

## 0.2 Figure out what the current frequency this board has

I checked `/sys/kernel/debug/clk/clk_summary` file:
```bash
cat /sys/kernel/debug/clk/clk_summary
                                 enable  prepare  protect                                duty
   clock                          count    count    count        rate   accuracy phase  cycle
---------------------------------------------------------------------------------------------
 audio_clock                          0        0        0    24576000          0     0  50000
 i2s_mclk                             2        2        0    24576000          0     0  50000

 ......

    clk_mpll                          1        1        0   850000000          0     0  50000
       clk_c906_0                     1        1        0   850000000          0     0  50000
```

As we can see at the end of the output, `clk_mpll`'s rate is 850000000, which is actually 850MHz. Also I did a simple test:
```c
#include <stdio.h>
#include <stdint.h>
#include <unistd.h>

#define read_csr(reg) ({ unsigned long __tmp; \
  asm volatile ("csrr %0, " #reg : "=r"(__tmp)); \
  __tmp; })

#define rdcycle() read_csr(cycle)

int main()
{
    uint64_t start, end;
    start = rdcycle();
    sleep(2);
    end = rdcycle();

    printf("start:%lu, end:%lu, duration:%lu\n", start, end, end - start);
    return 0;
}
```

The output of this program is `start:759809916968, end:761509990487, duration:1700073519`.

If the frequency is 1 GHz, the duration should approximately equals to 2000000000, rather than 1700073519. Combining this number (1700073519) with time (2s), the calculated frequency is approximately 850 MHz.

So why is this? Is there anyway to change the frequency to 1 GHz?

## 0.3 How do I overclock the CPU on my board?

Then I found this [discussion](https://community.milkv.io/t/is-it-possible-to-overclock-milk-v-duo-64m/3918). I tried, but it didn't work. I add the config, but nothing changed. But I still got something helpful, such as how to determine which frequency to use.

So I tried to make some adjustments in SDK source code, which belong to **FSBL** (First Stage BootLoader). 

As we can see in source file `duo-sdk/fsbl/plat/cv181x/platform.c`:
```c
// in function sys_pll_od
#ifdef __riscv
	// set mpll = 1050MHz
	mmio_write_32(0x03002908, 0x05548101);
	// set div, src_mux of clk_c906_0: [20:16]div_factor=1, [9:8]clk_src = 3 (mpll), 1050/1 = 1050MHz
	...
#else
	// set mpll = 1000MHz
	mmio_write_32(0x03002908, 0x05508101);
	...
#endif

// in function sys_pll_nd
#ifdef __riscv
	// set mpll = 850MHz
	mmio_write_32(0x03002908, 0x00448101);
	...
#else
	// set mpll = 800MHz
	mmio_write_32(0x03002908, 0x00408101);
	...
#endif

void sys_pll_init(void)
{
	switch (chip_clk_mode) {
	case CLK_VC_OD:
		sys_pll_nd(1);
		break;
	case CLK_OD:
		sys_pll_od();
		break;
	case CLK_ND:
	default:
		sys_pll_nd(0);
		break;
	}
}
```

The function `sys_pll_init` will determine the final frequency of the board, here I changed it to:
```c
void sys_pll_init(void)
{
	switch (CLK_OD) {
	case CLK_VC_OD:
		sys_pll_nd(1);
		break;
	case CLK_OD:
		sys_pll_od();
		break;
	case CLK_ND:
	default:
		sys_pll_nd(0);
		break;
	}
}
```

So it will set the frequency to 1050 MHz. You can make it with similar changes.

I finally change overclock the board with this method. Here are the results:
```bash
[root@milkv-duo]~# ./rdtsc
start:28260019503, end:30360135848, duration:2100116345

# duration:2100116345 cycles in 2s -> 1050MHz

# we can see in clk_summary: 1050000000
cat /sys/kernel/debug/clk/clk_summary
                                 enable  prepare  protect                                duty
   clock                          count    count    count        rate   accuracy phase  cycle
---------------------------------------------------------------------------------------------
 audio_clock                          0        0        0    24576000          0     0  50000
 i2s_mclk                             2        2        0    24576000          0     0  50000
 
 ......
 
    clk_mpll                          1        1        0  1050000000          0     0  50000
       clk_c906_0                     1        1        0  1050000000          0     0  50000
```

## 0.4 The underlying principle

The clock is set via the register `mpll_csr` at address `0x03002908`. These hexadecimal values encode **PLL (phase-locked loop) configuration fields**, rather than a frequency written directly into a register. 

The relevant fields are as follows. [SG2000 Technical Reference Manual, Chapter 8](https://vyndragon.github.io/data/sg2000.pdf)

| frequency | fields     | [26:24] |   [23:17]   | [16:15]  |    [14:8]    |    [6:0]    |                      PLL output                      |
| --------- | ---------- | :-----: | :---------: | :------: | :----------: | :---------: | :--------------------------------------------------: |
|           |            |  ictrl  |   div_sel   | sel_mode | post_div_sel | pre_div_sel | $25 MHz * div\_sel / pre\_div\_sel / post\_div\_sel$ |
| 1050MHz   | 0x05548101 | 101(5)  | 0101010(42) |  01(1)   |  0000001(1)  | 0000001(1)  |           $25MHz * 42 / 1 / 1 = 1050 MHz$            |
| 1000MHz   | 0x05508101 | 101(5)  | 0101000(40) |  01(1)   |  0000001(1)  | 0000001(1)  |           $25MHz * 40 / 1 / 1 = 1050 MHz$            |
| 850MHz    | 0x00448101 | 000(0)  | 0100010(34) |  01(1)   |  0000001(1)  | 0000001(1)  |           $25MHz * 34 / 1 / 1 = 1050 MHz$            |
| 800MHz    | 0x00408101 | 000(0)  | 0100000(32) |  01(1)   |  0000001(1)  | 0000001(1)  |           $25MHz * 32 / 1 / 1 = 1050 MHz$            |

**Why is 25MHz?** 
>We can know from this [manual](https://vyndragon.github.io/data/sg2000.pdf#page=121), that:
 XTAL_XIN is the PLL input lock, fixedly connected to the 25MHz crystal.

**How is the PLL output comes out?**
> With a **25 MHz reference clock and integer PLL operation**, the output frequency is:
  $PLL output frequency = 25 MHz * div\_sel / pre\_div\_sel / post\_div\_sel$

More about PLL, you can refer to [Clock and Pinctrl subsystem](../../knowledge/linux/内核机制/Clock%20and%20Pinctrl%20subsystem.md).