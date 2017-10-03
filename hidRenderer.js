const {ipcRenderer} = require('electron')

cbTable = {}
id = 0;
/*toArrayBuffer = (json) => {
  var str = JSON.stringify(json, null, 0);
	var ret = new Uint8Array(str.length);
	for (var k = 0; k < str.length; k++) {
		ret[k] = str.charCodeAt(k);
	}
	return ret.buffer
}*/

toArrayBuffer = (json) => {
  //bconsole.log("read from device", json)
  return hexToArrayBuffer(json);
}

/*function toJson(buffer) { 
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}*/

toJson = (ab) => {
  var list = [];
  var view = new Uint8Array(ab);
	for (var h = 0; h < view.length; h++) {
		list.push(parseInt(view[h]));
	}
	return list
}

// Listen for async-reply message from main process
ipcRenderer.on('hid-reply', (event, arg) => {  
    console.log("hid reply", arg.args, arg.id);
    if(arg.buffersBack.length > 0 ) {
      for (var l=0; l<arg.buffersBack.length; ++l) {
        arg.args[arg.buffersBack[l]] = toArrayBuffer(arg.args[arg.buffersBack[l]]);
      }
    }
    cbTable[arg.id].apply(this, arg.args);
    delete cbTable[arg.id];
});

makeCall = (call, args, cb) => {   
  var buffers = [];
  for (var i=0; i<args.length; ++i) {
    if( args[i] instanceof ArrayBuffer) {
      buffers.push(i);
    }
  }
  if (cb) {
    while (cbTable[++id] !== undefined){
    }
    cbTable[id] = args[args.length -1]

  } else {
    id = undefined
  }
  if (buffers.length > 0) {
    for(var j=0; j<buffers.length; ++j) {
      args[buffers[j]] = toJson(args[buffers[j]]);
    }
  }
  console.log("makecall", call, args, id)
  ipcRenderer.send('hid', {
    call: call,
    args: args,
    id: id,
    buffers: buffers
  })
}


chrome ={
  hid: {
    getDevices: (...params) => {
      makeCall(['getDevices'], params, true)
    },
    connect: (...params) => {
      makeCall(['connect'], params, true)
    },
    disconnect: (...params) => {
      makeCall(['disconnect'], params, true)
    },
    receive: (...params) => {
      makeCall(['receive'], params, true)
    },
    send: (...params) => {
      makeCall(['send'], params, true)
    },
    onDeviceRemoved: {
      addListener: (...params) => {
        makeCall(['onDeviceRemoved', 'addListener'], params, true)
      }
    },
  }
}