var HID = require('node-hid');
var devicesTable = {};
var matchTable = {};
var connectionTable = {};
var matchTable2 = {};
const manifest = require('./chromeApp/manifest.json')
var filters = [];
var disconnectCb = undefined

detectFilters = () => {
  for (i=0; i < manifest.permissions.length; ++i) {
    if (typeof(manifest.permissions[i]) === 'object') {
      for (j in manifest.permissions[i]) {
        if (manifest.permissions[i].hasOwnProperty(j) && j === "usbDevices") {
          filters = filters.concat(manifest.permissions[i].usbDevices)
        }
      }
    }
  }
  for (i=0; i < manifest.optional_permissions.length; ++i) {
    if (typeof(manifest.optional_permissions[i]) === 'object') {
      for (j in manifest.optional_permissions[i]) {
        if (manifest.optional_permissions[i].hasOwnProperty(j) && j === "usbDevices") {
          filters = filters.concat(manifest.optional_permissions[i].usbDevices)
        }
      }
    }
  }
}

detectFilters();

matchFilter = (device) => {
  var matched = 0;  
  if (filters.length > 0) {
    if (filters[0] === null) {
      return 1;
    }
    for (i=0; i < filters.length; ++i) {
      for ( key in filters[i]) {
        var localMatch = 0;
        if (filters[i].hasOwnProperty(key)) {
          if (filters[i][key] === device[key]) {
            localMatch = 1
          } else {
            localMatch = 0
          }
        }
        matched += localMatch;
      }
    }
  }
  return matched;
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

deviceToHid = (device, id) => {
  return {
    deviceId: id,
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.product,
    serialNumber: device.serialNumber,
    collections: [
      {
        reportIds: [],
        usage: 1,
        usagePage: 65440
      }
    ],
    maxInputReportSize: 64,
    maxOutputReportSize: 64,
    maxFeatureReportSize: 0,
    reportDescriptor: new ArrayBuffer, //getinterface
  };
}

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
      view[i] = buf[i];
  }
  return ab;
}

function toBuffer(ab) {
  var buf = new Buffer(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
      buf[i] = view[i];
  }
  return buf;
}

addDevice = (device, spec) => {
  var hash = device.path.hashCode();
  matchTable2[hash] = device;
  devicesTable2[hash] = deviceToHid(device, hash);
  if (spec) {
    specificTable[hash] = deviceToHid(device, hash);        
  }
}

deleteDevice = (deviceId) => {
  delete matchTable[deviceId];
  delete devicesTable[deviceId];
  try {
    connectionTable[connectionId].close();      
  } catch(e) {
    console.log("error closing connection", e)
  }
  delete connectionTable[deviceId];
  disconnectCb(deviceId);  
}

function gettingDevices() {
  setTimeout(function () {
      var devices = HID.devices();
      devicesTable2 = {};
      matchTable2 = {};
      for(var i = 0; i+1 <= devices.length; i++) {
        if (!devices[i].interface && matchFilter(devices[i])){
          addDevice(devices[i]);
        }
      }
      devicesTable = devicesTable2;
      matchTable = matchTable2;
      gettingDevices();
  }, 500);
}

gettingDevices();

chrome.hid = {
  getDevices: (options, cb) => {
    result = {};
    for (var device in matchTable) {
      if (matchTable.hasOwnProperty(device)) {
        if (options.hasOwnProperty("filters")) {
          if (options.filters.length > 0) {
            for (var j = 0; j < options.filters.length ; j++) {
              if (matchTable[device].productId === options.filters[j].productId && matchTable[device].vendorId === options.filters[j].vendorId) {
                result[device] = (devicesTable[device]);
              }
            }
          } else {
            result[device] = devicesTable[device];
          }
        } else if ((matchTable[device].productId === options.productId) || options.productId === undefined) {
          if ((matchTable[device].vendorId === options.vendorId) || options.vendorId === undefined) {
            result[device] = devicesTable[device];
          } 
        }
      }
    }
    cb(Object.values(result));
  },
  connect: (deviceId, cb) => {
    console.log("connecting:", matchTable[deviceId])
    try {
      if (!connectionTable[deviceId]) {
        connectionTable[deviceId] = new HID.HID(matchTable[deviceId].path);
      }
      cb({connectionId: deviceId})  
    } catch(e) {
      console.log("error connecting:",e);
      deleteDevice(deviceId);
    }
  },
  disconnect: (connectionId, cb) => {
    try {
      deleteDevice(connectionId);            
      if (cb) {
        cb()
      };
    } catch(e) {
      console.log("error disconnecting:",e);
    }
  },
  receive: (connectionId, cb) => {
    try {
      connectionTable[connectionId].read((err, data) => {
        console.log("read:", err, data, data.length);
        cb(0, data);
      });
    } catch(e) {
      console.log("receiving failed:", e);
      deleteDevice(connectionId);
    }
    /*connectionTable[connectionId].on("data", (data) =>  {//on crashes
      var reportId = 0;
      //console.log("received data", data)
      cb(reportId, data)
    })*/

    //cb(0, hexToArrayBuffer('01010500000002698200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'))    
  },
  send: (connectionId, reportId, data, cb) => {
    try {
      //console.log("sending:", data)
      connectionTable[connectionId].write(data) // BUG: if the first byte of a write() is 0x00, you may need to prepend an extra 0x00 due to a bug in hidapi (see issue #187)
      cb();
    } catch(e) {
      console.log("sending error:", e);
      deleteDevice(connectionId);
    }
    // reportId is always 0 in the case of ledger wallet chrome
  },
  onDeviceRemoved: {
    addListener: (cb) => {
      disconnectCb = cb
    }
  }
};



