/**
 * Bitcask Visualization Logic
 */

// --- Data Structures ---

class LogEntry {
    constructor(key, value, isTombstone = false) {
        this.timestamp = new Date().toISOString();
        this.key = key;
        this.value = value;
        this.isTombstone = isTombstone;
        // In a real system, we'd store size, crc, etc.
        // We simulate "offset" by array index for visualization simplicity.
    }
}

class KeyDirEntry {
    constructor(fileId, valueSize, valuePos, timestamp) {
        this.fileId = fileId;     // Simulating file name/id
        this.valueSize = valueSize; // Length of value
        this.valuePos = valuePos;   // Offset in the log
        this.timestamp = timestamp;
    }
}

class BitcaskStore {
    constructor() {
        this.log = []; // Array of LogEntry, acting as our "Disk"
        this.keyDir = new Map(); // Map<string, KeyDirEntry>, acting as our "Memory"
    }

    put(key, value) {
        // 1. Create a new entry
        const entry = new LogEntry(key, value);

        // 2. Append to log (Write to Disk)
        this.log.push(entry);
        const offset = this.log.length - 1; // 0-indexed position

        // 3. Update KeyDir (Update Memory)
        // In real bitcask: file_id, value_sz, value_pos, tstamp
        const keyDirEntry = new KeyDirEntry(
            "active.data", // We only visualize one active file for now
            JSON.stringify(value).length,
            offset,
            entry.timestamp
        );

        this.keyDir.set(key, keyDirEntry);
    }

    get(key) {
        // 1. Look up in KeyDir
        if (!this.keyDir.has(key)) {
            return null;
        }

        // 2. Retrieve location info
        const meta = this.keyDir.get(key);

        // 3. "Seek" to file/offset and read (from our array)
        const entry = this.log[meta.valuePos];

        // 4. Return value
        return entry.value; // The log entry should still be there!
    }

    delete(key) {
        // 1. Append special Tombstone record
        const entry = new LogEntry(key, "DELETE_TOMBSTONE", true);
        this.log.push(entry);

        // 2. Remove from KeyDir (so subsequent gets fail immediately)
        this.keyDir.delete(key);
    }
}

// --- UI Logic ---

const store = new BitcaskStore();

// DOM Elements
const formPut = document.getElementById('putForm');
const formGet = document.getElementById('getForm');
const formDelete = document.getElementById('deleteForm');

const inputPutKey = document.getElementById('putKey');
const inputPutValue = document.getElementById('putValue');
const inputGetKey = document.getElementById('getKey');
const inputDeleteKey = document.getElementById('deleteKey');

const resultBox = document.getElementById('getResult');
const logContainer = document.getElementById('diskLogContainer');
const keyDirContainer = document.getElementById('keyDirContainer');

// Helpers
function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString();
}

function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}

// Rendering
function render() {
    // 1. Render Log
    logContainer.innerHTML = '';

    if (store.log.length === 0) {
        logContainer.innerHTML = '<div class="empty-state">Disk is empty</div>';
    } else {
        store.log.forEach((entry, index) => {
            const el = document.createElement('div');
            el.className = `log-entry ${entry.isTombstone ? 'tombstone' : ''}`;

            const displayValue = entry.isTombstone ? 'DELETED' : entry.value;

            el.innerHTML = `
                <div class="log-entry-meta">
                    <span class="log-key">${entry.key}</span>
                    <span class="log-ts">offset: ${index} | ${formatTime(entry.timestamp)}</span>
                </div>
                <div class="log-val">${displayValue}</div>
            `;
            logContainer.appendChild(el);
        });
        scrollToBottom(logContainer);
    }

    // 2. Render KeyDir
    keyDirContainer.innerHTML = '';

    if (store.keyDir.size === 0) {
        keyDirContainer.innerHTML = '<div class="empty-state">KeyDir is empty</div>';
    } else {
        store.keyDir.forEach((meta, key) => {
            const el = document.createElement('div');
            el.className = 'keydir-entry';
            el.innerHTML = `
                <span class="keydir-key">${key}</span>
                <span class="keydir-ptr">
                    file: ${meta.fileId} <br>
                    offset: ${meta.valuePos} <br>
                    sz: ${meta.valueSize}
                </span>
            `;
            keyDirContainer.appendChild(el);
        });
    }
}

// Event Listeners

formPut.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = inputPutKey.value.trim();
    const val = inputPutValue.value.trim();
    if (!key || !val) return;

    store.put(key, val);

    inputPutKey.value = '';
    inputPutValue.value = '';
    inputPutKey.focus();

    render();
});

formGet.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = inputGetKey.value.trim();
    if (!key) return;

    const val = store.get(key);

    resultBox.classList.remove('hidden', 'error');
    if (val === null) {
        resultBox.classList.add('error');
        resultBox.textContent = `Key "${key}" not found (or deleted).`;
    } else {
        resultBox.textContent = `Value: ${val}`;
    }
});

formDelete.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = inputDeleteKey.value.trim();
    if (!key) return;

    // We can delete even if it doesn't exist, to show the tombstone log
    store.delete(key);

    inputDeleteKey.value = '';
    render();
});

// Initial Render
render();
