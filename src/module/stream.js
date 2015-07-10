export function read(incoming) {
    return co.wrap(function (resolve, reject) {
        let bufs = [];
        incoming.on('data', function (data) {
            bufs.push(data);
        }).on('end', function () {
            resolve(Buffer.concat(bufs));
        })
    })
}

