export function parse(body) {
    let reg = /<(\/)?(\w+)>/g, rCDATA = /<!\[CDATA\[([\s\S]+)\]\]>/, stack = [], m, curr = null, root = null, lastIdx = 0;

    while (m = reg.exec(body)) {
        if (curr) {
            curr.TEXT += body.substring(lastIdx, m.index);
        }
        lastIdx = m.index + m[0].length;
        let tag = m[2].toLowerCase();
        if (m[1]) { // ends
            if (tag !== curr.TAG) { // not match
                throw new Error('closed tag not match');
            }
            let text = curr.TEXT.trim();
            if (m = rCDATA.exec(text)) {
                text = m[1];
                curr.CDATA = true;
            } // TODO: xml unescape

            curr.TEXT = text;
            curr = stack.pop();
        } else {
            stack.push(curr);
            if (!root) {
                curr = root = {
                    TAG: tag, TEXT: ''
                };
            } else if (curr[tag]) {
                curr = curr[tag][curr[tag].length++] = {
                    TAG: tag,
                    TEXT: ''
                }
            } else {
                curr = curr[tag] = {
                    TAG: tag,
                    TEXT: '',
                    length: 1
                };
                curr[0] = curr;
            }
        }
    }
    if (stack.length) {
        throw new Error('Unclosed tags');
    }
    return root;
}

export function build(root) {
    return buildNode(root, 'xml');
}


function buildNode(obj, defaultTag) { // obj is single node
    let tag = obj.TAG || defaultTag;
    let buf = '';
    if ('TEXT' in obj) {
        buf = obj.TEXT;
        if (obj.CDATA) {
            buf = `<![CDATA[${buf}]]>`
        }
    }
    for (let key in obj) {
        if (key === 'length' || key === 'TEXT' || key === 'TAG' || key === 'CDATA') continue;

        let arrayOrNode = obj[key];
        if (arrayOrNode.length > 1) { // array
            for (let i = 0, L = arrayOrNode.length; i < L; i++) {
                buf += buildNode(arrayOrNode[i], key);
            }
        } else {
            buf += buildNode(arrayOrNode, key);
        }
    }

    return `<${tag}>${buf}</${tag}>`;
}
