// Initialize the Amazon Cognito credentials provider
AWS.config.region = 'eu-west-1'; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'eu-west-1:5f69b3ee-1b2e-4639-8f37-ef818b0664da',
});

var lambda = new AWS.Lambda();

function returnGreerings() {
	document.getElementById('submitButton').disabled = true;
	var name = document.getElementById('name');
	if (name.value == null || name.value == ''){
		input = {};
	} else {
		input = { 
			name: name.value
		}; 
	}
	lambda.invoke({
		FunctionName: 'greetingsOnDemand',
		Payload: JSON.stringify(input)
	}, function(err, data) {
		var result = document.getElementById('result');
		if (err) {
			console.log(err, err.stack);
			result.innerHTML = err;
		} else {
			var output = JSON.parse(data.Payload);
			result.innerHTML = output;
		}
		document.getElementById('submitButton').disabled = false;
	});
}

var form = document.getElementById('greetingsForm');
form.addEventListener('submit', function(evt) {
	evt.preventDefault();
	returnGreerings();
});
