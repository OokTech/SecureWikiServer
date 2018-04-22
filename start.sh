#!/bin/bash

# This starts the node server using nohup so it stays up until the server is
# restarted or it is manually stopped using stop.sh

nohup node ./index.js &
