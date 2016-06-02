const pools = {}; // url => pool

const _mysql = require('mysql'),
    _url = require('url');

/**
 * An abstraction that implements mysql operations and will execute its query on the original mysql connection object
 *
 * @export
 */
class Context {
    constructor(conn) {
        this._conn = conn;
    }

    query(sql, ...data) {
        const conn = this._conn;
        return co.promise(function (resolve, reject) {
            conn.query(sql, data, function (err, result) {
                if (err)reject(err);
                else resolve(result);
            })
        });
    }

    cachedStatement(sql, interval, serializer) {
        serializer = serializer || (data => data.join());
        interval = interval || 3000;
        const conn = this._conn;
        const cache = Object.create(null);

        let nextScan = Date.now() + interval; // key=>{expires, promise}

        return function (...data) {
            let now = Date.now(),
                key = serializer(data),
                cached = cache[key];
            if (cached && cached.expires > now) {
                return co.yield(cached.promise)
            }
            // not existed or expired

            if (nextScan < now) {
                // scan for expired keys
                for (let k in cache) {
                    if (cache[k].expires <= now) {
                        delete cache[k]
                    }
                }
                nextScan = now + interval;
            }
            cached = cache[key] = {
                expires: Infinity,
                promise: new Promise(function (resolve, reject) {
                    conn.query(sql, data, function (err, result) {
                        if (err) {
                            cached.expires = 0;
                            reject(err);
                        } else {
                            cached.expires = now + interval;
                            resolve(result);
                        }
                    })
                })
            };
            return co.yield(cached.promise)
        }
    }
}
/**
 * A dedicated connection that will be returned with pool.getConnection()
 * @export
 */
class Connection extends Context {
    constructor(conn) {
        super(conn);

        co.addResource(this)
    }

    close() {
        co.removeResource(this);
        this._conn.release();
        this._conn = null;
    }

    /**
     * called by co::cleanup
     * @private
     */
    _close() {
        if (this._conn) {
            this._conn.release();
            this._conn = null;
        }
    }
}
/**
 * @export
 */
class Transaction extends Connection {
    constructor(conn) {
        super(conn);
        this.query('start transaction');
    }

    commit() {
        this._conn.commit();
        this.close();
    }

    rollback() {
        this._conn.rollback();
        this.close();
    }

    /**
     * called by co::cleanup
     * @private
     */
    _close() {
        if (this._conn) {
            this._conn.rollback();
            this._conn.release();
            this._conn = null;
        }
    }
}
/**
 * @export
 */
class Pool extends Context {
    constructor(url) {
        let parsedurl = _url.parse(url, true);
        let options = parsedurl.query, tmp;

        options.host = parsedurl.hostname;
        if (tmp = parsedurl.port) {
            options.port = tmp;
        }
        if (tmp = parsedurl.auth) {
            let idx = tmp.indexOf(':');
            if (idx === -1) {
                options.user = tmp;
            } else {
                options.user = tmp.substr(0, idx);
                options.password = tmp.substr(idx + 1);
            }
        }
        if ((tmp = parsedurl.pathname).length > 1) {
            options.database = tmp.substr(1)
        }
        super(_mysql.createPool(options));
    }

    getConnection() {
        return new Connection(conn(this));
    }

    begin() {
        return new Transaction(conn(this));
    }
}

function conn(pool) {
    return co.promise((resolve, reject) => {
        pool._conn.getConnection(function (err, data) {
            if (err) reject(err);
            else resolve(data)
        });
    })
}

export function pool(url) {
    if (url in pools) return pools[url];
    return pools[url] = new Pool(url);
}