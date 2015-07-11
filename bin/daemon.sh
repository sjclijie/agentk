#!/bin/sh

exec su $1 << EOF
cd
mkdir -p .agentk
cd .agentk
exec "$2" --harmony "$3/index.js" "$3/src/service/daemon.js" >> out.log 2>> err.log

EOF
