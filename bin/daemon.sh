#!/bin/sh

# usage: NODE_EXEC=/usr/bin/node INSTALL_USER=john sh /.../bin/daemon.sh {install|uninst}


command -v initctl > /dev/null 2>&1 || { echo 'WARN: service daemon currently support upstart only, plz contact your admin'; }

method=upstart


upstart_install() {
    filename="/etc/init/ak_${INSTALL_USER}.conf"
    [ -f "$filename" ] && { echo "${INSTALL_USER}: service already installed"; exit 1; }

    dir=$(dirname $(dirname $0))

    cat <<EOF > "$filename"
description "AgentK: Integrated Node.JS Framework"

start on filesystem and static-network-up
stop on runlevel [016]

respawn

script
    exec /bin/su ${INSTALL_USER} << EOC
        cd
        mkdir -p .agentk
        cd .agentk
        exec ${NODE_EXEC} --harmony "${dir}/index.js" load "${dir}/src/service/daemon.js" >> out.log 2>> err.log
    EOC
end script
EOF

echo "${INSTALL_USER}: service installed, use 'initctl start ak_${INSTALL_USER}' to start the service"
}

upstart_uninst() {
    filename="/etc/init/ak_${INSTALL_USER}.conf"
    [ -f "$filename" ] || { echo "${INSTALL_USER}: service not installed"; exit 1; }
    rm "${filename}"
    echo "${INSTALL_USER}: service uninstall ok"
}

inittab_install() {
    current_content=$(cat /etc/inittab)
    found=""

    while [ "$found" = "" ]; do
        echo "$current_content" | grep
    done
}
${method}_${1}