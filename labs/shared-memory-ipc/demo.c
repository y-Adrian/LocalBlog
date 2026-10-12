#define _GNU_SOURCE
#ifndef __linux__
#error "This example requires Linux (eventfd and robust process-shared mutex)."
#endif
#include <errno.h>
#include <inttypes.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/eventfd.h>
#include <sys/mman.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>

#define CAPACITY 8u
#define MAGIC UINT32_C(0x49504331)
#define TIMEOUT_MS 5000

struct message { uint64_t sequence; };
struct shared_queue {
    uint32_t magic, version;
    pthread_mutex_t mutex;
    uint32_t head, tail, count, done, failed;
    uint64_t produced, consumed;
    struct message slots[CAPACITY];
};
struct resources {
    int listener, peer, shm, data_ready, space_ready;
    struct shared_queue *queue;
    char directory[64], path[108], shm_name[64];
};
static volatile sig_atomic_t stopping;
static void on_signal(int sig) { (void)sig; stopping = 1; }
static int64_t now_ms(void) {
    struct timespec t;
    if (clock_gettime(CLOCK_MONOTONIC, &t) < 0) return -1;
    return (int64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}
static void close_fd(int *fd) { if (*fd >= 0) close(*fd); *fd = -1; }
static void cleanup(struct resources *r) {
    if (r->queue != MAP_FAILED) munmap(r->queue, sizeof(*r->queue));
    close_fd(&r->peer); close_fd(&r->listener); close_fd(&r->shm);
    close_fd(&r->data_ready); close_fd(&r->space_ready);
    if (r->path[0]) unlink(r->path);
    if (r->directory[0]) rmdir(r->directory);
    /* Only populated after this process successfully created the object. */
    if (r->shm_name[0]) shm_unlink(r->shm_name);
}
static int wait_readable(int fd, int timeout) {
    struct pollfd p = { .fd = fd, .events = POLLIN };
    int64_t end = now_ms() + timeout;
    while (!stopping) {
        int64_t left = end - now_ms();
        if (left <= 0) { errno = ETIMEDOUT; return -1; }
        int rc = poll(&p, 1, (int)left);
        if (rc < 0 && errno == EINTR) continue;
        if (rc < 0) return -1;
        if (rc == 0) { errno = ETIMEDOUT; return -1; }
        if (p.revents & POLLIN) return 0;
        errno = ECONNRESET; return -1;
    }
    errno = EINTR; return -1;
}
static int lock_queue(struct shared_queue *q) {
    int64_t end = now_ms() + TIMEOUT_MS;
    while (!stopping) {
        int rc = pthread_mutex_trylock(&q->mutex);
        if (rc == 0) {
            if (q->failed || q->count > CAPACITY || q->head >= CAPACITY ||
                q->tail >= CAPACITY) {
                pthread_mutex_unlock(&q->mutex); errno = EPROTO; return -1;
            }
            return 0;
        }
        if (rc == EOWNERDEAD) {
            /* Fail the entire session: do not attempt to repair a half-write. */
            q->failed = 1;
            pthread_mutex_unlock(&q->mutex); /* Deliberately not consistent. */
            errno = EOWNERDEAD; return -1;
        }
        if (rc != EBUSY) { errno = rc; return -1; }
        if (now_ms() >= end) { errno = ETIMEDOUT; return -1; }
        struct timespec pause = { .tv_nsec = 1000000 };
        nanosleep(&pause, NULL);
    }
    errno = EINTR; return -1;
}
static int notify(int fd) {
    uint64_t one = 1;
    ssize_t n;
    do { n = write(fd, &one, sizeof(one)); } while (n < 0 && errno == EINTR && !stopping);
    if (n == (ssize_t)sizeof(one)) return 0;
    /* Saturation means an unread notification already exists for this sole reader. */
    if (n < 0 && errno == EAGAIN) return 0;
    return -1;
}
static int wait_change(int event, int peer, int64_t deadline) {
    struct pollfd p[2] = {
        { .fd = event, .events = POLLIN },
        { .fd = peer, .events = POLLIN }
    };
    while (!stopping) {
        int64_t left = deadline - now_ms();
        if (left <= 0) { errno = ETIMEDOUT; return -1; }
        int rc = poll(p, 2, (int)left);
        if (rc < 0 && errno == EINTR) continue;
        if (rc < 0) return -1;
        if (!rc) { errno = ETIMEDOUT; return -1; }
        /* No application messages belong on the control socket while moving data. */
        if (p[1].revents) { errno = ECONNRESET; return -1; }
        if (p[0].revents & POLLIN) {
            uint64_t count;
            ssize_t n = read(event, &count, sizeof(count));
            if (n == (ssize_t)sizeof(count) || (n < 0 && errno == EAGAIN)) return 0;
            if (n < 0 && errno == EINTR) continue;
            errno = EIO; return -1;
        }
        if (p[0].revents) { errno = EIO; return -1; }
    }
    errno = EINTR; return -1;
}
static int send_descriptors(struct resources *r) {
    char ready = 'R';
    int fds[3] = { r->shm, r->data_ready, r->space_ready };
    union { struct cmsghdr align; char bytes[CMSG_SPACE(sizeof(fds))]; } control = {0};
    struct iovec iov = { .iov_base = &ready, .iov_len = 1 };
    struct msghdr msg = { .msg_iov = &iov, .msg_iovlen = 1,
        .msg_control = control.bytes, .msg_controllen = sizeof(control.bytes) };
    struct cmsghdr *c = CMSG_FIRSTHDR(&msg);
    c->cmsg_level = SOL_SOCKET; c->cmsg_type = SCM_RIGHTS;
    c->cmsg_len = CMSG_LEN(sizeof(fds));
    memcpy(CMSG_DATA(c), fds, sizeof(fds));
    return sendmsg(r->peer, &msg, MSG_NOSIGNAL) == 1 ? 0 : -1;
}
static int receive_descriptors(struct resources *r) {
    if (wait_readable(r->peer, TIMEOUT_MS) < 0) return -1;
    char ready = 0;
    int fds[3] = {-1, -1, -1};
    size_t count = 0;
    union { struct cmsghdr align; char bytes[CMSG_SPACE(sizeof(fds))]; } control = {0};
    struct iovec iov = { .iov_base = &ready, .iov_len = 1 };
    struct msghdr msg = { .msg_iov = &iov, .msg_iovlen = 1,
        .msg_control = control.bytes, .msg_controllen = sizeof(control.bytes) };
    ssize_t n = recvmsg(r->peer, &msg, MSG_CMSG_CLOEXEC);
    for (struct cmsghdr *c = CMSG_FIRSTHDR(&msg); n >= 0 && c; c = CMSG_NXTHDR(&msg, c)) {
        if (c->cmsg_level != SOL_SOCKET || c->cmsg_type != SCM_RIGHTS ||
            c->cmsg_len < CMSG_LEN(0)) continue;
        size_t bytes = c->cmsg_len - CMSG_LEN(0);
        for (size_t i = 0; i + sizeof(int) <= bytes; i += sizeof(int)) {
            int fd;
            memcpy(&fd, (char *)CMSG_DATA(c) + i, sizeof(fd));
            if (count < 3) fds[count++] = fd; else close(fd);
        }
    }
    if (n != 1 || ready != 'R' || count != 3 || (msg.msg_flags & (MSG_CTRUNC | MSG_TRUNC))) {
        for (size_t i = 0; i < count; ++i) close(fds[i]);
        errno = EPROTO; return -1;
    }
    r->shm = fds[0]; r->data_ready = fds[1]; r->space_ready = fds[2];
    struct stat st;
    if (fstat(r->shm, &st) < 0) return -1;
    if (st.st_size != (off_t)sizeof(struct shared_queue)) { errno = EPROTO; return -1; }
    r->queue = mmap(NULL, sizeof(*r->queue), PROT_READ | PROT_WRITE, MAP_SHARED, r->shm, 0);
    if (r->queue == MAP_FAILED) return -1;
    if (r->queue->magic != MAGIC || r->queue->version != 1) { errno = EPROTO; return -1; }
    return 0;
}
static int initialize(struct resources *r) {
    char name[64];
    snprintf(name, sizeof(name), "/adrian-ipc-%ld", (long)getpid());
    r->shm = shm_open(name, O_CREAT | O_EXCL | O_RDWR, 0600);
    if (r->shm < 0) return -1;
    strcpy(r->shm_name, name);
    if (shm_unlink(name) < 0) return -1;
    r->shm_name[0] = 0; /* fd passing lets us remove the name before publication. */
    if (ftruncate(r->shm, sizeof(*r->queue)) < 0) return -1;
    r->queue = mmap(NULL, sizeof(*r->queue), PROT_READ | PROT_WRITE, MAP_SHARED, r->shm, 0);
    if (r->queue == MAP_FAILED) return -1;
    memset(r->queue, 0, sizeof(*r->queue));
    pthread_mutexattr_t attr;
    int rc = pthread_mutexattr_init(&attr);
    if (rc) { errno = rc; return -1; }
    rc = pthread_mutexattr_setpshared(&attr, PTHREAD_PROCESS_SHARED);
    if (!rc) rc = pthread_mutexattr_setrobust(&attr, PTHREAD_MUTEX_ROBUST);
    if (!rc) rc = pthread_mutex_init(&r->queue->mutex, &attr);
    pthread_mutexattr_destroy(&attr);
    if (rc) { errno = rc; return -1; }
    r->queue->magic = MAGIC; r->queue->version = 1;
    r->data_ready = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
    r->space_ready = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
    return r->data_ready < 0 || r->space_ready < 0 ? -1 : 0;
}
static int producer(struct resources *r, uint64_t total) {
    if (initialize(r) < 0) return -1;
    char directory[] = "/tmp/adrian-ipc-XXXXXX";
    if (!mkdtemp(directory)) return -1;
    strcpy(r->directory, directory);
    snprintf(r->path, sizeof(r->path), "%s/control.sock", directory);
    struct sockaddr_un addr = { .sun_family = AF_UNIX };
    strcpy(addr.sun_path, r->path);
    r->listener = socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
    if (r->listener < 0 || bind(r->listener, (struct sockaddr *)&addr, sizeof(addr)) < 0 ||
        listen(r->listener, 1) < 0) return -1;
    printf("consumer command: ./demo consumer %s\n", r->path); fflush(stdout);
    if (wait_readable(r->listener, 30000) < 0) return -1;
    r->peer = accept4(r->listener, NULL, NULL, SOCK_CLOEXEC);
    if (r->peer < 0 || send_descriptors(r) < 0 || wait_readable(r->peer, TIMEOUT_MS) < 0) return -1;
    char ack;
    if (recv(r->peer, &ack, 1, 0) != 1 || ack != 'A') { errno = EPROTO; return -1; }
    uint64_t full_observations = 0;
    for (uint64_t i = 0; i < total; ++i) {
        int64_t deadline = now_ms() + TIMEOUT_MS;
        for (;;) {
            if (lock_queue(r->queue) < 0) return -1;
            if (r->queue->count < CAPACITY) {
                r->queue->slots[r->queue->tail].sequence = i;
                r->queue->tail = (r->queue->tail + 1) % CAPACITY;
                ++r->queue->count; ++r->queue->produced;
                pthread_mutex_unlock(&r->queue->mutex);
                if (notify(r->data_ready) < 0) return -1;
                break;
            }
            pthread_mutex_unlock(&r->queue->mutex);
            ++full_observations;
            if (wait_change(r->space_ready, r->peer, deadline) < 0) return -1;
        }
    }
    if (lock_queue(r->queue) < 0) return -1;
    r->queue->done = 1;
    pthread_mutex_unlock(&r->queue->mutex);
    if (notify(r->data_ready) < 0 || wait_readable(r->peer, TIMEOUT_MS) < 0) return -1;
    if (recv(r->peer, &ack, 1, 0) != 1 || ack != 'D') { errno = EPROTO; return -1; }
    if (lock_queue(r->queue) < 0) return -1;
    int valid = r->queue->consumed == total && r->queue->count == 0;
    pthread_mutex_unlock(&r->queue->mutex);
    if (!valid) { errno = EPROTO; return -1; }
    printf("producer: sent=%" PRIu64 " full_observations=%" PRIu64 " complete\n", total, full_observations);
    return 0;
}
static int consumer(struct resources *r, const char *path) {
    struct sockaddr_un addr = { .sun_family = AF_UNIX };
    if (strlen(path) >= sizeof(addr.sun_path)) { errno = ENAMETOOLONG; return -1; }
    strcpy(addr.sun_path, path);
    r->peer = socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
    if (r->peer < 0 || connect(r->peer, (struct sockaddr *)&addr, sizeof(addr)) < 0 ||
        receive_descriptors(r) < 0) return -1;
    if (send(r->peer, "A", 1, MSG_NOSIGNAL) != 1) return -1;
    uint64_t expected = 0;
    int64_t deadline = now_ms() + TIMEOUT_MS;
    for (;;) {
        if (lock_queue(r->queue) < 0) return -1;
        if (r->queue->count) {
            struct message local = r->queue->slots[r->queue->head];
            r->queue->head = (r->queue->head + 1) % CAPACITY;
            --r->queue->count; ++r->queue->consumed;
            pthread_mutex_unlock(&r->queue->mutex);
            if (local.sequence != expected++) { errno = EPROTO; return -1; }
            if (notify(r->space_ready) < 0) return -1;
            deadline = now_ms() + TIMEOUT_MS;
            continue;
        }
        int done = r->queue->done;
        pthread_mutex_unlock(&r->queue->mutex);
        if (done) break;
        if (wait_change(r->data_ready, r->peer, deadline) < 0) return -1;
    }
    if (send(r->peer, "D", 1, MSG_NOSIGNAL) != 1) return -1;
    printf("consumer: received=%" PRIu64 " complete\n", expected);
    return 0;
}
int main(int argc, char **argv) {
    if (argc < 2) goto usage;
    uint64_t total = 100;
    int is_producer = strcmp(argv[1], "producer") == 0;
    if (is_producer && argc == 3) {
        char *end;
        errno = 0;
        unsigned long long value = strtoull(argv[2], &end, 10);
        if (errno || !argv[2][0] || *end || value < 1 || value > 1000000) goto usage;
        total = (uint64_t)value;
    } else if (!(is_producer && argc == 2) &&
               !(argc == 3 && strcmp(argv[1], "consumer") == 0)) goto usage;
    struct sigaction sa = { .sa_handler = on_signal };
    sigemptyset(&sa.sa_mask);
    if (sigaction(SIGINT, &sa, NULL) < 0 || sigaction(SIGTERM, &sa, NULL) < 0) {
        perror("sigaction"); return 1;
    }
    struct resources r = { .listener = -1, .peer = -1, .shm = -1,
        .data_ready = -1, .space_ready = -1, .queue = MAP_FAILED };
    int rc = is_producer ? producer(&r, total) : consumer(&r, argv[2]);
    int saved = errno;
    cleanup(&r);
    if (rc < 0) { errno = saved; perror("session failed"); return 1; }
    return 0;
usage:
    fprintf(stderr, "usage: %s producer [1..1000000] | consumer SOCKET_PATH\n", argv[0]);
    return 2;
}
