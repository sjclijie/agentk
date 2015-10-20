/**
 * Simple LRU cache implemention
 * @param capacity
 */

/**
 *
 * @param {number} [capacity] maximum number of keys, defaults to 300
 * @returns {object} a object which contains `get` and `set`
 */
export default function LRUCache(capacity) {
    if (!capacity || capacity < 0) capacity = 300;

    const entries = {};
    var head = null, tail = null, count = 0;

    function update(entry) {
        if (entry === head) return;

        if (entry === tail) {
            tail = entry.prev;
            tail.next = null;
        } else {
            entry.prev.next = entry.next;
            entry.next.prev = entry.prev;
        }

        head.prev = entry;
        entry.next = head;
        entry.prev = null;
        head = entry;
    }

    return {
        get: function (key) {
            const entry = entries[key];
            if (entry) {
                update(entry);
                return entry.value;
            }
        },
        set: function (key, value) {
            let entry = entries[key];
            if (entry) {
                update(entry);
            } else if (count === capacity) { // drop tail
                entry = tail;
                delete entries[entry.key];
                entry.key = key;
                entries[key] = entry;
                update(entry);
            } else {
                entry = entries[key] = {
                    key: key,
                    prev: null,
                    next: head,
                    value: -1
                };
                if (count) {
                    head.prev = entry;
                } else {
                    tail = entry;
                }
                head = entry;
                count++;
            }
            entry.value = value;
        }
    }
}