const pools = {}; // url => pool

const _mysql = require('mysql'),
    _url = require('url');

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
}

class Connection extends Context {
    close() {
        this._conn.release();
        this._conn = null;
    }
}

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
}

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