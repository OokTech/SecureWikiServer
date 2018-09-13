#!/bin/bash

# This starts the node server using nohup so it stays up until the server is
# restarted or it is manually stopped using stop.sh
# The process id is stored in wikiserver.pid so that the process can be stopped
# without trouble is stop.sh
source ../.bashrc

nohup node ./index.js &

PID=$!

echo $PID > wikiserver.pid
