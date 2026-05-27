#include "fd_guard.hpp"

#include <fcntl.h>
#include <iostream>
#include <utility>

int main()
{
    FdGuard g(open("/etc/hosts", O_RDONLY));
    if (g.get() < 0) {
        perror("open");
        return 1;
    }

    FdGuard h(std::move(g));
    std::cout << "fd=" << h.get() << " (moved, auto-close on scope exit)\n";
    return 0;
}
