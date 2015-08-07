#!/bin/sh

dir=$(dirname $(dirname $0))

exec su "$1" << EOC
    cd
    mkdir -p .agentk
    cd .agentk
    exec "$2" --harmony "$dir/index.js" load "$dir/src/service/daemon.js" >> out.log 2>> err.log
EOC
