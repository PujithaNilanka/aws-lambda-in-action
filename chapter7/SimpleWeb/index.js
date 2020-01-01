/*
Note: This need node_modules fs and ejs. Use 
	npm install ejs fs

*/
console.log('Loading fucntion');

const fs = require('fs');
const ejs = require('ejs');

exports.handler = (event, context, callback) => {
    console.log('Received Event: ', JSON.stringify(event, null, 2));
    // Build local file name included in the function deployment package, based on the path in the event.
    var fileName = './content' + event.path + 'index.ejs';
    console.log('File Name : ', fileName);
    fs.readFile(fileName, function(err, data) {
        if(err) {
            // If the file is missing fail returning an error string that API G/W can map to HTTP 404
            callback("Error 404");
        } else {
            // Interpret the EJS template server-side to produce HTML content.
            var html = ejs.render(data.toString());
            // Return the HTML wrapped in JSON to preserve encoding
            callback(null, { data : html });
        }
    });
};
