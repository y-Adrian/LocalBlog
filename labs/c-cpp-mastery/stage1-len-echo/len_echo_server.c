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
#define MAX_BODY (64 * 1024)

static int handle_client(int cfd)
{
    for (;;) {
        uint32_t net_len;
        ssize_t n = read_full(cfd, &net_len, sizeof net_len);
        if (n == 0)
            return 0;
        if (n < 0) {
            perror("read_full len");
            return -1;
        }
        if (n != (ssize_t)sizeof net_len) {
            fprintf(stderr, "short read on length prefix\n");
            return -1;
        }

        uint32_t len = ntohl(net_len);
        if (len == 0 || len > MAX_BODY) {
            fprintf(stderr, "invalid body length: %u\n", len);
            return -1;
        }

        char *body = malloc(len);
        if (!body) {
            perror("malloc");
            return -1;
        }

        n = read_full(cfd, body, len);
        if (n != (ssize_t)len) {
            fprintf(stderr, "short read on body\n");
            free(body);
            return -1;
        }

        if (write_full(cfd, &net_len, sizeof net_len) < 0 ||
            write_full(cfd, body, len) < 0) {
            perror("write_full");
            free(body);
            return -1;
        }
        free(body);
    }
}

int main(void)
{
    int lfd = socket(AF_INET, SOCK_STREAM, 0);
    if (lfd < 0) {
        perror("socket");
        return 1;
    }

    int yes = 1;
    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);

    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_addr.s_addr = htonl(INADDR_LOOPBACK),
        .sin_port = htons(DEFAULT_PORT),
    };

    if (bind(lfd, (struct sockaddr *)&addr, sizeof addr) < 0) {
        perror("bind");
        close(lfd);
        return 1;
    }
    if (listen(lfd, 1) < 0) {
        perror("listen");
        close(lfd);
        return 1;
    }

    printf("len_echo_server listening on 127.0.0.1:%d\n", DEFAULT_PORT);

    int cfd = accept(lfd, NULL, NULL);
    close(lfd);
    if (cfd < 0) {
        perror("accept");
        return 1;
    }

    int rc = handle_client(cfd);
    close(cfd);
    return rc == 0 ? 0 : 1;
}
