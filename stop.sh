#!/bin/bash

#Note that this will only work if there is only one node process going.
# I am not sure what will happen if there are others.

kill -9 `pgrep node`
