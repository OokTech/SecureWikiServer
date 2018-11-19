#!/bin/bash

# This starts the node server using nohup so it stays up until the server is
# restarted or it is manually stopped using stop.sh
# The process id is stored in wikiserver.pid so that the process can be stopped
# without trouble with stop.sh
source ../.bashrc

OLDPID=$(cat wikiserver.pid)

# Check to make sure that the process isn't already running before trying to
# start it
if [ -n "$(ps -p $OLDPID -o pid=)" ]; then
  echo "Server is already running with PID $OLDPID"
else
  nohup node ./index.js &

  PID=$!

  echo $PID > wikiserver.pid

  echo "Server is running with PID $PID"
fi
