import ConnectionPool from 'connection_pool'
const _zk = require('node-zookeeper-client');

class Client {
    constructor(connectionString) {
        const zookeeper = this._zk = _zk.createClient(connectionString);
        co.promise(function (resolve, reject) {
            zookeeper.once('connected', resolve);
            zookeeper.connect();
        });
    }

    pool(path, connections) {
        // TODO cache pools
        const pool = new ConnectionPool([], connections),
            zookeeper = this._zk;
        return new Promise(function (resolve, reject) {
            zookeeper.getChildren(path, function watcher(event) {
                // console.log('recv event', event);
                zookeeper.getChildren(path, watcher, update);
            }, function (error, children) {
                if (error) {
                    reject(error);
                } else {
                    update(null, children);
                    resolve(pool);
                }
            });
        });

        function update(err, children) {
            // console.log('update children', children);
            pool.update(children ? children.map(function (s) {
                return s.match(/^\w+:(.+?:\d+)/)[1]
            }) : []);
        }
    }
}

const clients = {};

export function client(connectionString) {
    return clients[connectionString] || (clients[connectionString] = new Client(connectionString))
}