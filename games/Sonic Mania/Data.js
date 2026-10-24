var Module = typeof Module != 'undefined' ? Module : {};

if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
Module['expectedDataFileDownloads']++;
(() => {
  var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
  var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
  if (isPthread || isWasmWorker) return;
  var isNode = globalThis.process && globalThis.process.versions && globalThis.process.versions.node && globalThis.process.type != 'renderer';

  async function loadPackage(metadata) {
    var PACKAGE_NAME = 'Data.data';
    var NUM_PARTS = 14;
    var BASE_URL = 'https://cdn.jsdelivr.net/gh/UGBONTOP/Sonic-Mania-InYourBrowser@main/';

    async function fetchPart(partIndex) {
      var partName = `Data.data.part${partIndex}`;
      var url = BASE_URL + partName;

      if (isNode) {
        var contents = require('fs').readFileSync(partName);
        return new Uint8Array(contents);
      }

      Module['setStatus'] && Module['setStatus'](`Downloading part ${partIndex + 1}/${NUM_PARTS}...`);

      var response;
      try {
        response = await fetch(url);
      } catch (e) {
        throw new Error(`Network Error: ${url}`, { cause: e });
      }
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.url}`);
      }

      const chunks = [];
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((a, c) => a + c.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }

    async function fetchAndAssemble() {
      const partPromises = [];
      for (let i = 0; i < NUM_PARTS; i++) {
        partPromises.push(fetchPart(i));
      }
      const parts = await Promise.all(partPromises);

      const totalSize = parts.reduce((a, p) => a + p.length, 0);
      const assembled = new Uint8Array(totalSize);
      let offset = 0;
      for (const part of parts) {
        assembled.set(part, offset);
        offset += part.length;
      }

      Module['setStatus'] && Module['setStatus']('Assembling Data.data...');
      return assembled.buffer;
    }

    async function runWithFS(Module) {
      function assert(check, msg) {
        if (!check) throw new Error(msg);
      }

      for (var file of metadata['files']) {
        Module['addRunDependency'](`fp ${file['filename']}`);
      }

      async function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData ' + arrayBuffer.constructor.name);
        var byteArray = new Uint8Array(arrayBuffer);
        for (var file of metadata['files']) {
          var name = file['filename'];
          var data = byteArray.subarray(file['start'], file['end']);
          Module['FS_createDataFile'](name, null, data, true, true, true);
          Module['removeRunDependency'](`fp ${name}`);
        }
        Module['removeRunDependency']('datafile_Data.data');
      }

      Module['addRunDependency']('datafile_Data.data');
      if (!Module['preloadResults']) Module['preloadResults'] = {};
      Module['preloadResults'][PACKAGE_NAME] = { fromCache: false };

      const assembled = await fetchAndAssemble();
      processPackageData(assembled);
    }

    if (Module['calledRun']) {
      runWithFS(Module);
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module['preRun'].push(runWithFS);
    }
  }

  loadPackage({
    "files": [{ "filename": "/Data.rsdk", "start": 0, "end": 208368695 }],
    "remote_package_size": 208368695
  });
})();