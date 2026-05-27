#include "dpdk_bridge.h"

#include <iostream>

int main(int argc, char **argv)
{
    if (dpdk_eal_init(argc, argv) != 0)
        return 1;
    std::cout << "C++ after EAL\n";
    return 0;
}
