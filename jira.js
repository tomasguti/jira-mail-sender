//JIRA Query 0.0.1
var secret = require('./secret');
var request = require('request');

//Basic Auth
var credentials = new Buffer(secret.user + ":" + secret.password).toString('base64');
var authHeader = {
	'Authorization': 'Basic ' + credentials
}

var options = {
	url: secret.filterEndPoint,
	headers: authHeader
}

exports.getIssues = getIssues;

//For Test this module only.
/*
getIssues(function(error, issues){
	for (var i = 0; i < issues.length; i++) {
		var issue = issues[i];
		console.log(issue);
	}
});*/

function getIssues(callback){
	//Get the filter, and return a searchUrl.
	request.get(options,
		function (error, response, body) {
			if(!error){
				var json = JSON.parse(body);
				searchIssues(json.searchUrl, callback);
			}else{
				console.log(error);
				callback(error);
			}
		}
	);	
}

//Get the issues from filter
function searchIssues(searchUrl, callback){
	var searchOptions = {
		url: searchUrl,
		headers: authHeader
	} 
	request.get(searchOptions,
		function (error, response, body) {
			if(!error){
				parseIssues(body, callback);
			}else{
				console.log(error);
				callback(error);
			}
		}
	);
}

var waitingForResponses = 0;
var issues = [];

function parseIssues(body, callback){
	
	var json = JSON.parse(body);
	for (var i = 0; i < json.issues.length; i++) {
		var issue = json.issues[i];
		//console.log(issue.fields);
		var simpleIssue = {
			'key': issue.key,
			'summary': issue.fields.summary,
			'original': minutesToHours(issue.fields.aggregatetimeoriginalestimate),
			'remaining': minutesToHours(issue.fields.aggregatetimeestimate),
			'status': issue.fields.status.name,
			'comment': ''
		}
		issues.push(simpleIssue);

		//Overwrite with the Guesstimate
		for(var j = 0; j < issue.fields.subtasks.length; j++){
			var subtask = issue.fields.subtasks[j];
			if(subtask.fields.summary.toUpperCase() == "GUESSTIMATE"){
				getSubtaskTime(subtask.self, simpleIssue, callback);
			}
		}
		
	}
	
	//Don't wait for subtasks callback
	if(waitingForResponses == 0){
		callback(null, issues);
	}
}

function getSubtaskTime(subtaskURL, originalIssue, callback){
	waitingForResponses++;
	var searchSubtask = {
		url: subtaskURL,
		headers: authHeader
	} 
	request.get(searchSubtask, function (error, response, subtaskBody) {
		if(!error){
			var jsonSubtask = JSON.parse(subtaskBody);
			originalIssue.original = minutesToHours(jsonSubtask.fields.aggregatetimeoriginalestimate);
			originalIssue.remaining = minutesToHours(jsonSubtask.fields.aggregatetimeestimate);
		}else{
			console.log(error);
			callback(null);
		}
		waitingForResponses--;
		if(waitingForResponses == 0){
			callback(null, issues);
		}
	});
}

function minutesToHours(minutes){
	var rounded = minutes/60/60;
	var result;
	
	if(rounded*60*60 == minutes || rounded.toFixed(1) == 0.0){
		result = rounded;
	}else{
		result = rounded.toFixed(1);
	}
	return result;
}
