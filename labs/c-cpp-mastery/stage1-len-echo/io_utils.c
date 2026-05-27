#include "io_utils.h"

#include <errno.h>
#include <unistd.h>

ssize_t read_full(int fd, void *buf, size_t count)
{
    size_t off = 0;

    while (off < count) {
        ssize_t n = read(fd, (char *)buf + off, count - off);
        if (n < 0) {
            if (errno == EINTR)
                continue;
            return -1;
        }
        if (n == 0)
            return (ssize_t)off;
        off += (size_t)n;
    }
    return (ssize_t)count;
}

ssize_t write_full(int fd, const void *buf, size_t count)
{
    size_t off = 0;

    while (off < count) {
        ssize_t n = write(fd, (const char *)buf + off, count - off);
        if (n < 0) {
            if (errno == EINTR)
                continue;
            return -1;
        }
        off += (size_t)n;
    }
    return (ssize_t)count;
}
