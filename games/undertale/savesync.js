/*
 * WigdosXP Unified Save System for deltarune
 * Handles: IndexedDB ↔ localStorage ↔ WigdosXP parent frame ↔ Firebase
 */

(function() {
    'use strict';
    
    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    
    const CONFIG = {
        gameId: 'ut',
        debug: true,
        
        // IndexedDB settings
        db: {
            name: '/_savedata',
            storeName: 'FILE_DATA'
        },
        
        // localStorage prefix for save files
        localStoragePrefix: 'ut',
        
        // Sync intervals
        indexedDBSyncInterval: 10000, // 10 seconds
        wigdosXPSyncInterval: 5000     // 5 seconds
    };

    // ============================================================================
    // LOGGING
    // ============================================================================
    
    function log(message, data = null) {
        if (CONFIG.debug) {
            console.debug('[WigdosXP Unified Save]', message, data || '');
        }
    }

    // Serialization helpers to preserve binary/Date types when moving data to localStorage
    function arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        var binary = atob(base64);
        var len = binary.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = function() {
                var dataUrl = reader.result || '';
                var comma = dataUrl.indexOf(',');
                resolve(dataUrl.slice(comma + 1));
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Recursively serialize values for localStorage. Returns a Promise<string>.
    async function serializeForLocalStorage(value) {
        if (value === null) return 'JS:__NULL__';
        if (value === undefined) return 'JS:__UNDEFINED__';
        if (value instanceof Date) return 'DATE:' + value.getTime();
        if (value instanceof ArrayBuffer) return 'AB:' + arrayBufferToBase64(value);
        if (ArrayBuffer.isView(value)) {
            var ctorName = (value.constructor && value.constructor.name) || 'Uint8Array';
            return 'TA:' + ctorName + ':' + arrayBufferToBase64(value.buffer);
        }
        if (value instanceof Blob) {
            var b64 = await blobToBase64(value);
            return 'BL:' + b64;
        }
        if (typeof value === 'object') {
            // Serialize each property recursively, storing the serialized strings in an object
            var out = Array.isArray(value) ? [] : {};
            for (var k in value) {
                if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
                out[k] = await serializeForLocalStorage(value[k]);
            }
            return 'OBJ:' + JSON.stringify(out);
        }
        // primitive (number, string, boolean)
        return 'JS:' + JSON.stringify(value);
    }

    // Recursively deserialize a previously serialized string
    function deserializeFromLocalStorage(str) {
        if (str === null) return null;
        if (str === 'JS:__NULL__') return null;
        if (str === 'JS:__UNDEFINED__') return undefined;
        if (str.indexOf('AB:') === 0) return base64ToArrayBuffer(str.slice(3));
        if (str.indexOf('TA:') === 0) {
            // Typed array: format TA:ConstructorName:base64
            var rest = str.slice(3);
            var idx = rest.indexOf(':');
            if (idx === -1) return base64ToArrayBuffer(rest);
            var ctor = rest.slice(0, idx);
            var b64 = rest.slice(idx + 1);
            var ab = base64ToArrayBuffer(b64);
            try {
                var T = typeof globalThis !== 'undefined' && globalThis[ctor] ? globalThis[ctor] : null;
                if (T) return new T(ab);
            } catch (e) {}
            return ab;
        }
        if (str.indexOf('BL:') === 0) return new Blob([base64ToArrayBuffer(str.slice(3))], { type: 'application/octet-stream' });
        if (str.indexOf('DATE:') === 0) return new Date(Number(str.slice(5)));
        if (str.indexOf('JS:') === 0) return JSON.parse(str.slice(3));
        if (str.indexOf('OBJ:') === 0) {
            var inner = JSON.parse(str.slice(4));
            function rev(v) {
                if (v === null) return null;
                if (typeof v === 'string') {
                    // strings in the object are serialized pieces; call again to deserialize leaf
                    return deserializeFromLocalStorage(v);
                }
                if (Array.isArray(v)) return v.map(rev);
                if (typeof v === 'object') {
                    var o = Array.isArray(v) ? [] : {};
                    for (var p in v) if (Object.prototype.hasOwnProperty.call(v, p)) o[p] = rev(v[p]);
                    return o;
                }
                return v;
            }
            return rev(inner);
        }
        // Unknown format; return raw string
        return str;
    }
    
    // ============================================================================
    // GAME STARTUP MANAGEMENT
    // ============================================================================
    
    const START_MESSAGE = '✅ Save data loaded from Firestore into iframe';
    let _gameStarted = false;
    let _startAttempted = false;
    
    function _startGameOnce() {
        if (_gameStarted || _startAttempted) return;
        _startAttempted = true;
        
        log('Starting game...');
        
        // Try different possible game start functions
        const startFunctions = [
            () => typeof startGame === 'function' && startGame(),
            () => typeof GameMaker_Init === 'function' && GameMaker_Init(),
            () => typeof window.GameMaker_Init === 'function' && window.GameMaker_Init()
        ];
        
        for (const fn of startFunctions) {
            try {
                if (fn()) {
                    log('Game started successfully');
                    _gameStarted = true;
                    break;
                }
            } catch (e) {
                // Try next function
            }
        }
        
        // Set deltarune_loaded flag
        if (!localStorage.getItem('deltarune_loaded')) {
            localStorage.setItem('deltarune_loaded', 'true');
            log('Set deltarune_loaded flag');
        }
        
        _gameStarted = true;
    }
    
    function setupConsoleWrapper() {
        if (typeof console === 'undefined') return;
        
        const _orig = console.debug.bind(console);
        console.debug = function(...args) {
            try { _orig(...args); } catch (e) {}
            try {
                // In background-save mode we do not auto-start the game.
                // Keep console output intact but don't trigger `_startGameOnce` here.
                if (_gameStarted) return;
                for (const a of args) {
                    if (typeof a === 'string' && a.includes(START_MESSAGE)) {
                        log('Detected save-ready log (no auto-start in background mode).');
                        break;
                    }
                }
            } catch (e) {}
        };
    }
    
    // ============================================================================
    // INDEXEDDB OPERATIONS
    // ============================================================================
    
    const IndexedDBSync = {
        openDB: function() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(CONFIG.db.name);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(CONFIG.db.storeName)) {
                        // Try to create the object store via a version upgrade
                        try {
                            const currentVersion = db.version || 1;
                            db.close();
                            console.warn('[WigdosXP Unified Save] Store', CONFIG.db.storeName, 'not found — attempting to create it (upgrade).');
                            const upgradeReq = indexedDB.open(CONFIG.db.name, currentVersion + 1);
                            upgradeReq.onupgradeneeded = function(evt) {
                                const upgDb = evt.target.result;
                                if (!upgDb.objectStoreNames.contains(CONFIG.db.storeName)) {
                                    const os = upgDb.createObjectStore(CONFIG.db.storeName);
                                    try {
                                        // create a timestamp index similar to runner expectations
                                        os.createIndex && os.createIndex('timestamp', 'timestamp', { unique: false });
                                        console.info('[WigdosXP Unified Save] Created object store and index', CONFIG.db.storeName, 'index:timestamp');
                                    } catch (e) {
                                        console.warn('[WigdosXP Unified Save] Could not create index on new store', e);
                                    }
                                }
                            };
                            upgradeReq.onerror = function() { reject(upgradeReq.error || new Error('Upgrade failed')); };
                            upgradeReq.onsuccess = function() { resolve(upgradeReq.result); };
                        } catch (e) {
                            reject(e);
                        }
                        return;
                    }
                    resolve(db);
                };
            });
        },
        
        getAllFromIndexedDB: function() {
            return new Promise(async (resolve, reject) => {
                try {
                    const db = await this.openDB();
                    const transaction = db.transaction([CONFIG.db.storeName], 'readonly');
                    const store = transaction.objectStore(CONFIG.db.storeName);

                    const values = [];
                    const keys = [];
                    const timestamps = {}; // map key -> timestamp (if available via index)

                    // If index 'timestamp' exists, build a mapping from primaryKey -> timestamp
                    if (store.indexNames && store.indexNames.contains && store.indexNames.contains('timestamp')) {
                        await new Promise((res, rej) => {
                            const idxCursorReq = store.index('timestamp').openKeyCursor();
                            idxCursorReq.onsuccess = ev => {
                                const cur = ev.target.result;
                                if (!cur) return res();
                                try {
                                    timestamps[cur.primaryKey] = cur.key;
                                } catch (e) {}
                                cur.continue && cur.continue();
                            };
                            idxCursorReq.onerror = ev => rej(ev.target.error || ev.error || new Error('index cursor error'));
                        });
                    }

                    await new Promise((res, rej) => {
                        const req = store.openCursor();
                        req.onsuccess = ev => {
                            const cur = ev.target.result;
                            if (!cur) return res();
                            keys.push(cur.primaryKey);
                            values.push(cur.value);
                            // attach timestamp if we found it via the index
                            if (typeof timestamps[cur.primaryKey] !== 'undefined') {
                                // leave mapping in separate structure so we don't mutate binary values
                            }
                            cur.continue && cur.continue();
                        };
                        req.onerror = ev => rej(ev.target.error || ev.error || new Error('cursor error'));
                    });

                    resolve({ values, keys, timestamps });
                } catch (error) {
                    reject(error);
                }
            });
        },
        
        saveToIndexedDB: function(key, data) {
            return new Promise(async (resolve, reject) => {
                try {
                    const db = await this.openDB();
                    const transaction = db.transaction([CONFIG.db.storeName], 'readwrite');
                    const store = transaction.objectStore(CONFIG.db.storeName);
                    const request = store.put(data, key);
                    
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                } catch (error) {
                    reject(error);
                }
            });
        },
        
        // Export IndexedDB → localStorage
        exportToLocalStorage: function() {
            return new Promise(async (resolve, reject) => {
                try {
                    const data = await this.getAllFromIndexedDB();
                    
                    if (data.keys.length === 0) {
                        log('No save data in IndexedDB to export');
                        resolve(0);
                        return;
                    }
                    // Serialize each value (handles binary Date/ArrayBuffer/Blob) and store as string
                    const MAX_LOCALSTORAGE_BYTES = 4 * 1024 * 1024; // 4MB soft limit per origin (adjust as needed)
                    const storePromises = data.keys.map(async (key, index) => {
                        const localStorageKey = CONFIG.localStoragePrefix + key;
                        const value = data.values[index];
                        try {
                            const serialized = await serializeForLocalStorage(value);
                            // Size check (approximate, char -> byte)
                            if (serialized.length > MAX_LOCALSTORAGE_BYTES) {
                                console.warn('[WigdosXP Unified Save] Skipping export of', key, '— serialized size', serialized.length, 'bytes exceeds limit');
                                return false;
                            }
                            localStorage.setItem(localStorageKey, serialized);
                            // If we have a timestamp mapping from the DB index, preserve it as companion meta
                            if (data.timestamps && typeof data.timestamps[key] !== 'undefined') {
                                try {
                                    localStorage.setItem(localStorageKey + '::ts', String(data.timestamps[key]));
                                } catch (e) {}
                            }
                            return true;
                        } catch (serr) {
                            console.error('Error serializing key', key, serr);
                            return false;
                        }
                    });

                    const results = await Promise.all(storePromises);
                    const successCount = results.filter(Boolean).length;
                    log('✓ IndexedDB → localStorage:', successCount, 'files (', data.keys.length, 'found )');
                    resolve(successCount);

                    // Notify WigdosXP that save data changed
                    WigdosXPSync.notifySaveDataChanged();
                    
                } catch (error) {
                    console.error('Error exporting to localStorage:', error);
                    reject(error);
                }
            });
        },
        
        // Import localStorage → IndexedDB
        importFromLocalStorage: function() {
            return new Promise(async (resolve, reject) => {
                try {
                    let importCount = 0;
                    const promises = [];
                    
                    for (let i = 0; i < localStorage.length; i++) {
                        const localKey = localStorage.key(i);
                        
                        if (!localKey) continue;
                        // Skip companion timestamp meta keys we create (suffix '::ts')
                        if (localKey.endsWith('::ts')) continue;

                        if (localKey && localKey.startsWith(CONFIG.localStoragePrefix)) {
                            const indexedDBKey = localKey.substring(CONFIG.localStoragePrefix.length);
                            const dataString = localStorage.getItem(localKey);
                            try {
                                const data = deserializeFromLocalStorage(dataString);
                                promises.push(
                                    this.saveToIndexedDB(indexedDBKey, data).then(async () => {
                                        importCount++;
                                        log('✓ Restored to IndexedDB:', indexedDBKey);

                                        // After writing, try to verify whether the 'timestamp' index/value exists and log it
                                        try {
                                            const db = await this.openDB();
                                            const tx = db.transaction([CONFIG.db.storeName], 'readonly');
                                            const store = tx.objectStore(CONFIG.db.storeName);
                                            if (store.indexNames && store.indexNames.contains && store.indexNames.contains('timestamp')) {
                                                await new Promise((res, rej) => {
                                                    const idxReq = store.index('timestamp').getKey(indexedDBKey);
                                                    idxReq.onsuccess = ev => {
                                                        const foundTs = ev.target.result;
                                                        const metaKey = CONFIG.localStoragePrefix + indexedDBKey + '::ts';
                                                        const expected = localStorage.getItem(metaKey);
                                                        console.debug('[WigdosXP Unified Save] Post-import timestamp check for', indexedDBKey, 'indexTs=', foundTs, 'expectedTs=', expected);
                                                        res();
                                                    };
                                                    idxReq.onerror = ev => {
                                                        console.warn('[WigdosXP Unified Save] Could not read timestamp index for', indexedDBKey, ev && ev.target && ev.target.error);
                                                        res();
                                                    };
                                                });
                                            }
                                        } catch (e) {
                                            console.warn('[WigdosXP Unified Save] Timestamp verification failed for', indexedDBKey, e);
                                        }
                                    })
                                );
                            } catch (parseError) {
                                console.error('Deserialize error for key:', localKey, parseError);
                            }
                        }
                    }
                    
                    await Promise.all(promises);
                    
                    if (importCount > 0) {
                        log('✓ localStorage → IndexedDB:', importCount, 'files');
                    }
                    
                    resolve(importCount);
                } catch (error) {
                    console.error('Error importing from localStorage:', error);
                    reject(error);
                }
            });
        },
        
        initialize: function() {
            log('Initializing IndexedDB sync...');
            
            this.importFromLocalStorage()
                .then(() => {
                    return this.exportToLocalStorage();
                })
                .then(() => {
                    log('✓ IndexedDB sync initialized');
                    
                    // Periodic IndexedDB → localStorage sync
                    setInterval(() => {
                        this.exportToLocalStorage().catch(err => {
                            console.error('Periodic IndexedDB sync failed:', err);
                        });
                    }, CONFIG.indexedDBSyncInterval);
                })
                .catch(error => {
                    console.error('IndexedDB sync initialization failed:', error);
                });
        }
    };
    
    // ============================================================================
    // WIGDOSXP PARENT FRAME COMMUNICATION
    // ============================================================================
    
    const WigdosXPSync = {
        isInIframe: window.parent !== window,
        lastSyncedData: null,
        
        // Send all localStorage to WigdosXP parent
        notifySaveDataChanged: function() {
            if (!this.isInIframe) return;
            
            try {
                const allLocalStorageData = {};
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    // don't send internal timestamp meta keys
                    if (!key || key.endsWith('::ts')) continue;
                    allLocalStorageData[key] = localStorage.getItem(key);
                }
                
                // Only send if data actually changed
                const dataString = JSON.stringify(allLocalStorageData);
                if (dataString === this.lastSyncedData) {
                    return;
                }
                this.lastSyncedData = dataString;
                
                window.parent.postMessage({
                    type: 'saveDataChanged',
                    gameId: CONFIG.gameId,
                    allLocalStorageData: allLocalStorageData
                }, '*');
                
                log('✓ localStorage → WigdosXP parent frame');
                
            } catch (error) {
                console.error('Error notifying WigdosXP:', error);
            }
        },
        
        // Request initial save data from WigdosXP
        requestInitialSaveData: function() {
            if (!this.isInIframe) return;
            
            const messageId = `initial_load_${Date.now()}`;
            
            log('Requesting initial save data from WigdosXP...');
            
            const timeout = setTimeout(() => {
                log('Timeout waiting for initial save data');
            }, 5000);
            
            const responseHandler = function(event) {
                if (event.data && event.data.type === 'initialSaveDataResponse' && event.data.messageId === messageId) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', responseHandler);
                    
                    log('Received initial save data from WigdosXP');
                    
                    if (event.data.allLocalStorageData && Object.keys(event.data.allLocalStorageData).length > 0) {
                        log('Loading initial save data:', Object.keys(event.data.allLocalStorageData).length, 'items');
                        
                        // Load into localStorage
                        Object.keys(event.data.allLocalStorageData).forEach(key => {
                            localStorage.setItem(key, event.data.allLocalStorageData[key]);
                        });
                        
                        // Then sync to IndexedDB
                        IndexedDBSync.importFromLocalStorage().then(() => {
                            log('✓ WigdosXP → localStorage → IndexedDB complete');
                            
                            // Start game after save data is loaded
                            // NOTE: running in background-save mode — do NOT auto-start the game here.
                            log('Save data loaded; background sync complete (no auto-start).');
                        });
                        
                        window.dispatchEvent(new CustomEvent('wigdosxp-save-loaded', {
                            detail: {
                                gameId: CONFIG.gameId,
                                data: event.data.allLocalStorageData,
                                isInitialLoad: true
                            }
                        }));
                    }
                }
            };
            
            window.addEventListener('message', responseHandler);
            
            window.parent.postMessage({
                type: 'getInitialSaveData',
                gameId: CONFIG.gameId,
                messageId: messageId
            }, '*');
        },
        
        // Handle messages from WigdosXP parent
        setupMessageListeners: function() {
            if (!this.isInIframe) return;
            
            window.addEventListener('message', function(event) {
                if (window.parent === window || !event.data || !event.data.type) return;
                
                log('Received message from WigdosXP:', event.data.type);
                
                switch (event.data.type) {
                    case 'getAllLocalStorageData':
                        WigdosXPSync.handleGetAllLocalStorageData(event);
                        break;
                        
                    case 'setAllLocalStorageData':
                        WigdosXPSync.handleSetAllLocalStorageData(event);
                        break;
                        
                    case 'requestSnapshot':
                        WigdosXPSync.handleSnapshotRequest(event);
                        break;
                }
            });
        },
        
        handleGetAllLocalStorageData: function(event) {
            try {
                const allLocalStorageData = {};
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    allLocalStorageData[key] = localStorage.getItem(key);
                }
                
                event.source.postMessage({
                    type: 'saveDataResponse',
                    messageId: event.data.messageId,
                    allLocalStorageData: allLocalStorageData
                }, event.origin);
                
                log('✓ Sent save data to WigdosXP');
                
            } catch (error) {
                console.error('Error getting localStorage:', error);
                event.source.postMessage({
                    type: 'saveDataResponse',
                    messageId: event.data.messageId,
                    allLocalStorageData: null,
                    error: error.message
                }, event.origin);
            }
        },
        
        handleSetAllLocalStorageData: function(event) {
            try {
                if (event.data.allLocalStorageData) {
                    log('Restoring save data from WigdosXP:', Object.keys(event.data.allLocalStorageData).length, 'items');
                    
                    // Clear and restore localStorage
                    localStorage.clear();
                    
                    Object.keys(event.data.allLocalStorageData).forEach(key => {
                        localStorage.setItem(key, event.data.allLocalStorageData[key]);
                    });
                    
                    // Sync to IndexedDB
                    IndexedDBSync.importFromLocalStorage().then(() => {
                        log('✓ WigdosXP → localStorage → IndexedDB complete');
                        
                        // Send success response
                        event.source.postMessage({
                            type: 'loadDataResponse',
                            messageId: event.data.messageId,
                            success: true
                        }, event.origin);
                        
                        // Reload page to apply save data
                        log('Reloading page to apply save data...');
                        setTimeout(() => {
                            window.location.reload();
                        }, 100);
                    });
                    
                    window.dispatchEvent(new CustomEvent('wigdosxp-save-loaded', {
                        detail: {
                            gameId: CONFIG.gameId,
                            data: event.data.allLocalStorageData
                        }
                    }));
                }
                
            } catch (error) {
                console.error('Error setting localStorage:', error);
                event.source.postMessage({
                    type: 'loadDataResponse',
                    messageId: event.data.messageId,
                    success: false,
                    error: error.message
                }, event.origin);
            }
        },
        
        handleSnapshotRequest: function(event) {
            try {
                if (typeof html2canvas !== 'undefined') {
                    html2canvas(document.body, {
                        width: 240,
                        height: 140,
                        scale: 0.3
                    }).then(canvas => {
                        event.source.postMessage({
                            type: 'snapshotResponse',
                            messageId: event.data.messageId,
                            dataUrl: canvas.toDataURL('image/png')
                        }, event.origin);
                        log('✓ Sent snapshot to WigdosXP');
                    }).catch(err => {
                        log('Snapshot capture failed:', err);
                        event.source.postMessage({
                            type: 'snapshotResponse',
                            messageId: event.data.messageId,
                            dataUrl: null
                        }, event.origin);
                    });
                } else {
                    event.source.postMessage({
                        type: 'snapshotResponse',
                        messageId: event.data.messageId,
                        dataUrl: null
                    }, event.origin);
                }
            } catch (error) {
                console.error('Error handling snapshot:', error);
            }
        },
        
        sendReadySignal: function() {
            if (!this.isInIframe) return;
            
            setTimeout(() => {
                window.parent.postMessage({
                    type: 'wigdosxp-integration-ready',
                    gameId: CONFIG.gameId
                }, '*');
                log('✓ Sent ready signal to WigdosXP');
            }, 1000);
        },
        
        initialize: function() {
            if (!this.isInIframe) {
                log('Running standalone - WigdosXP sync disabled');
                return;
            }
            
            log('Initializing WigdosXP sync...');
            this.requestInitialSaveData();
            this.setupMessageListeners();
            this.sendReadySignal();
            
            // Periodic localStorage → WigdosXP sync
            setInterval(() => {
                this.notifySaveDataChanged();
            }, CONFIG.wigdosXPSyncInterval);
        }
    };
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    log('WigdosXP Unified Save System starting...');
    
    // Set up console wrapper to detect game ready
    setupConsoleWrapper();
    
    // Wait for IndexedDB to be created by the game
    window.addEventListener('load', function() {
        (async function waitForIndexedDB() {
            log('Waiting for IndexedDB to be created by the game...');

            while (true) {
                try {
                    await IndexedDBSync.openDB();
                    log('✓ IndexedDB found, initializing...');

                    // Initialize IndexedDB sync first
                    IndexedDBSync.initialize();

                    // Then initialize WigdosXP sync
                    WigdosXPSync.initialize();

                    log('✓ Unified save system initialized');
                    break;
                } catch (error) {
                    // Quietly wait for the game to create the DB/store and try again
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        })();
    });
    
    // No fallback start: save-sync runs in background and will not auto-start the game.
    
    log('✓ Unified save system ready');
    
})();