#include "dpdk_bridge.h"

#include <stdio.h>

int dpdk_eal_init(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    fprintf(stderr, "stub: dpdk_eal_init ok\n");
    return 0;
}
