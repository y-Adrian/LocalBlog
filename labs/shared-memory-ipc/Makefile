CC = cc
CFLAGS = -std=c11 -O2 -g -Wall -Wextra -Wpedantic
LDLIBS = -pthread -lrt

all: demo

demo: demo.c
	$(CC) $(CFLAGS) -o $@ $< $(LDLIBS)

clean:
	rm -f demo *.o

.PHONY: all clean
