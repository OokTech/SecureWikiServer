#!/bin/bash

# This starts the node server using nohup so it stays up until the server is
# restarted or it is manually stopped using stop.sh

export TIDDLYWIKI_PLUGIN_PATH="./Plugins"

nohup node ./index.js &
