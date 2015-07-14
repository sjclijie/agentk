#!/bin/sh

dir=$(dirname $(dirname $0))

exec su $1 << EOF
cd
mkdir -p .agentk
cd .agentk
exec "$2" --harmony "$dir/index.js" "$dir/src/service/daemon.js" >> out.log 2>> err.log

EOF
