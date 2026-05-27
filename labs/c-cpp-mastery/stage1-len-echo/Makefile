CC = cc
CFLAGS = -Wall -Wextra -std=c11 -g

OBJS = io_utils.o

all: len_echo_server len_echo_client

len_echo_server: $(OBJS) len_echo_server.o
	$(CC) $(CFLAGS) -o $@ $^

len_echo_client: $(OBJS) len_echo_client.o
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c io_utils.h
	$(CC) $(CFLAGS) -c $<

clean:
	rm -f *.o len_echo_server len_echo_client

.PHONY: all clean
