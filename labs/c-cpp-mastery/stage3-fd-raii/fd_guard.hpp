#pragma once

#include <unistd.h>
#include <utility>

class FdGuard {
public:
    explicit FdGuard(int fd = -1) noexcept : fd_(fd) {}
    ~FdGuard() { reset(); }

    FdGuard(const FdGuard &) = delete;
    FdGuard &operator=(const FdGuard &) = delete;

    FdGuard(FdGuard &&other) noexcept : fd_(other.fd_) { other.fd_ = -1; }
    FdGuard &operator=(FdGuard &&other) noexcept
    {
        if (this != &other) {
            reset();
            fd_ = other.fd_;
            other.fd_ = -1;
        }
        return *this;
    }

    int get() const noexcept { return fd_; }
    int release() noexcept
    {
        int tmp = fd_;
        fd_ = -1;
        return tmp;
    }
    void reset(int fd = -1)
    {
        if (fd_ >= 0)
            close(fd_);
        fd_ = fd;
    }

private:
    int fd_;
};
