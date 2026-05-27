#include "io_utils.h"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define DEFAULT_PORT 9999

static int send_frame(int fd, const char *msg)
{
    size_t len = strlen(msg);
    if (len == 0 || len > UINT32_MAX)
        return -1;

    uint32_t net_len = htonl((uint32_t)len);
    if (write_full(fd, &net_len, sizeof net_len) < 0)
        return -1;
    if (write_full(fd, msg, len) < 0)
        return -1;
    return 0;
}

static int recv_frame(int fd, char **out, size_t *out_len)
{
    uint32_t net_len;
    if (read_full(fd, &net_len, sizeof net_len) != (ssize_t)sizeof net_len)
        return -1;

    uint32_t len = ntohl(net_len);
    if (len == 0)
        return -1;

    char *buf = malloc(len + 1);
    if (!buf)
        return -1;

    if (read_full(fd, buf, len) != (ssize_t)len) {
        free(buf);
        return -1;
    }
    buf[len] = '\0';
    *out = buf;
    *out_len = len;
    return 0;
}

int main(int argc, char **argv)
{
    const char *msg = argc > 1 ? argv[1] : "hello";

    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) {
        perror("socket");
        return 1;
    }

    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_addr.s_addr = htonl(INADDR_LOOPBACK),
        .sin_port = htons(DEFAULT_PORT),
    };

    if (connect(fd, (struct sockaddr *)&addr, sizeof addr) < 0) {
        perror("connect");
        close(fd);
        return 1;
    }

    if (send_frame(fd, msg) != 0) {
        fprintf(stderr, "send_frame failed\n");
        close(fd);
        return 1;
    }

    char *reply = NULL;
    size_t reply_len = 0;
    if (recv_frame(fd, &reply, &reply_len) != 0) {
        fprintf(stderr, "recv_frame failed\n");
        close(fd);
        return 1;
    }

    printf("%s\n", reply);
    free(reply);
    close(fd);
    return 0;
}
