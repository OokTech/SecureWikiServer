#!/bin/bash

# You need to use the full path here, ~/TiddlyWiki/Plugins doesn't work
export TIDDLYWIKI_PLUGIN_PATH="/home/inmysocks/TiddlyWiki/Plugins"
export TIDDLYWIKI_THEME_PATH="/home/inmysocks/TiddlyWiki/Themes"
export TIDDLYWIKI_EDITION_PATH="/home/inmysocks/TiddlyWiki/Editions"

node ./index.js
