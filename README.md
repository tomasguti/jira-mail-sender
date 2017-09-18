## Prerequisites

Node.js installed and working on your development machine. 

## Installing the dependencies

```
cd jira-mail-sender
npm install
```

## Running the app

```
cd jira-mail-sender
node mail.js
```

## Sample secret.js file

```javascript
//JIRA CREDENTIALS
exports.user = "yourmail@outlook.com";
exports.password = "password";
exports.filterEndPoint = 'url to the JIRA filter';

//RECIPIENT MAIL
exports.recipient = "recipient@outlook.com";

//OUTLOOK APP SECRET
exports.client = { id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', secret: 'xxxxxxxxxxxxxxxxxxxxxxx' }
```
