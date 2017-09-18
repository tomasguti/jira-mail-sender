// Copyright (c) Microsoft. All rights reserved. Licensed under the MIT license. See LICENSE.txt in the project root for license information.
var server = require('./server');
var router = require('./router');
var jira = require('./jira');
var secret = require('./secret');
var pug = require('pug');
var readline = require('readline');
var merge = require('merge');
var moment = require('moment');
var authHelper = require('./authHelper');
var microsoftGraph = require("@microsoft/microsoft-graph-client");
const util = require('util');
var opn = require('opn');
var html;
var comment;
var issues;
var serverInstance;

var handle = {};
handle['/'] = home;
handle['/authorize'] = authorize;
handle['/mail'] = mail;

var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('Comment> ');
rl.on('line', function(line) {
	comment = line;
	rl.close();
}).on('close',function(){
	if(comment != null){
		console.log("Getting issues from JIRA...");
		jira.getIssues(function(error, myIssues){
			if(!error){
				issues = myIssues;
				if(issues.length > 0){
					getIssueComment(0);
				}else{
					console.log("No issues to comment.");
					openMailPage();
				}
			}
		});
	}
});

rl.prompt();

function home(response, request) {
	//Render Mail
	var options = { pretty: true };
	var totalHours = 0;
	var remainingHours = 0;
	issues.forEach(function(issue){
		totalHours += parseFloat(issue.original);
		remainingHours += parseFloat(issue.remaining);
	});
	displayTable = issues.length > 0;
	var locals = { 
		'totalHours': totalHours,
		'remainingHours': remainingHours,
		'issues': issues,
		'comment': comment,
		'displayTable': displayTable
	} ;
	html = pug.renderFile('mail.pug', merge(options, locals));
	response.writeHead(200, {'Content-Type': 'text/html'});
	response.write(html);
	response.write('<p><a href=\'/mail\'>Send Email<a></p>');
	response.end();
}

function getIssueComment(index){
	var issue = issues[index];
	console.log(issue);
	var issueLineReader = readline.createInterface(process.stdin, process.stdout);
	issueLineReader.setPrompt(issue.key+' Comment> ');
	issueLineReader.prompt();
	issueLineReader.on('line', function(line) {
		issue.comment = line;
		issueLineReader.close();
	}).on('close',function(){
		if(index < issues.length - 1){
			getIssueComment(index + 1);
		}else{
			openMailPage();
		}
	});
}

function openMailPage(){
	if(serverInstance == null){
		server.start(router.route, handle);
	}
	opn('http://localhost:8000');
}

var url = require('url');
function authorize(response, request) {
	//console.log('Request handler \'authorize\' was called.');
	// The authorization code is passed as a query parameter
	var url_parts = url.parse(request.url, true);
	var code = url_parts.query.code;
	//console.log('Code: ' + code);
	authHelper.getTokenFromCode(code, tokenReceived, response);
}

function tokenReceived(response, error, token) {
	if (error) {
		console.log('Access token error: ', error.message);
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.write('<p>ERROR: ' + error + '</p>');
		response.end();
	} else {  
		getUserEmail(token.token.access_token, function(error, email){
			if (error) {
				console.log('getUserEmail returned an error: ' + error);
				response.write('<p>ERROR: ' + error + '</p>');
				response.end();
			} else if (email) {
				var cookies = ['daily-mail-token=' + token.token.access_token + ';Max-Age=4000',
				'daily-mail-refresh-token=' + token.token.refresh_token + ';Max-Age=4000',
				'daily-mail-token-expires=' + token.token.expires_at.getTime() + ';Max-Age=4000',
				'daily-mail-email=' + email + ';Max-Age=4000'];
				response.setHeader('Set-Cookie', cookies);
				response.writeHead(302, {'Location': '/mail'});
				response.end();
			}
		}); 
	}
}

function getUserEmail(token, callback) {
	// Create a Graph client
	var client = microsoftGraph.Client.init({
	authProvider: (done) => {
		// Just return the token
		done(null, token);
		}
	});
	// Get the Graph /Me endpoint to get user email address
	client
	.api('/me')
	.get((err, res) => {
		if (err) {
			callback(err, null);
		} else {
			callback(null, res.mail);
		}
	});
}

function getValueFromCookie(valueName, cookie) {
  if (cookie != null && cookie.indexOf(valueName) !== -1) {
    var start = cookie.indexOf(valueName) + valueName.length + 1;
    var end = cookie.indexOf(';', start);
    end = end === -1 ? cookie.length : end;
    return cookie.substring(start, end);
  }
  return null;
}

function getAccessToken(request, response, callback) {
    // refresh token
    console.log('Getting Token');
    var refresh_token = getValueFromCookie('daily-mail-refresh-token', request.headers.cookie);
    authHelper.refreshAccessToken(refresh_token, function(error, newToken){
      if (error) {
        callback(error, null);
      } else if (newToken) {
        var cookies = ['daily-mail-token=' + newToken.token.access_token + ';Max-Age=4000',
                       'daily-mail-refresh-token=' + newToken.token.refresh_token + ';Max-Age=4000',
                       'daily-mail-token-expires=' + newToken.token.expires_at.getTime() + ';Max-Age=4000'];
        response.setHeader('Set-Cookie', cookies);
		console.log(util.inspect(newToken));
        callback(null, newToken.token.access_token);
      }
    });
}

function mail(response, request) {
	var newMessage = {
	  "message": {
		"subject": "Dev Estimate - Automation FW Work - " + moment().format("MMM [the] Do"),
		"toRecipients": [
		  {
			"emailAddress": {
			  "address": secret.recipient
			}
		  }
		],
		"body": {
		  "contentType": "html",
		  "content": html
		}
		/*,
		"ccRecipients": [
		  {
			"emailAddress": {
			  "address": "address1@test.com"
			}
		  },
		  {
			"emailAddress": {
			  "address": "address2@test.com"
			}
		  }
		]*/
	  },
	  "saveToSentItems": "true"
	}
	
	getAccessToken(request, response, function(error, token) {
		console.log('Token found in cookie: ', token);
		var email = getValueFromCookie('daily-mail-email', request.headers.cookie);
		console.log('Email found in cookie: ', email);
		if (token) {
			response.writeHead(200, {'Content-Type': 'text/html'});
			//response.write('<div><h1>Your inbox</h1></div>');

			// Create a Graph client
			var client = microsoftGraph.Client.init({
				authProvider: (done) => {
					// Just return the token
					done(null, token);
				}
			});

			client
			.api('/me/sendMail')
			.header('X-AnchorMailbox', email)
			.post(newMessage, (err, res) => {
				if (err) {  
					console.log(util.inspect(err));		
					response.write('<p>ERROR: ' + err + '</p>');
					response.end();
				} else {
					console.log('Mail sent.');
					response.write('<div><h1>Mail sent.</h1></div>');
					response.end();
					server.stop();
				}
			});
		} else {
			console.log("Token Expired, redirecting to login...");
			response.writeHead(302, { 'Location': authHelper.getAuthUrl() });
			response.end();
		}
	});
}