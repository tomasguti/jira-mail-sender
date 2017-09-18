// Copyright (c) Microsoft. All rights reserved. Licensed under the MIT license. See LICENSE.txt in the project root for license information.
var http = require('http');
var url = require('url');
var server;

function start(route, handle) {
  function onRequest(request, response) {
    var pathName = url.parse(request.url).pathname;
    //console.log('Request for ' + pathName + ' received.');
    route(handle, pathName, response, request);
  }
  
  var port = 8000;
  server = http.createServer(onRequest).listen(port);
  console.log('Server has started. Listening on port: ' + port + '...');
}

function stop() {
	server.close(function(){
		console.log("Server stopped.");
		process.exit();
	});
}

exports.stop = stop;
exports.start = start;