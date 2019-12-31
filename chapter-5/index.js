/*
NOTES :
1. To install dependency node_modules run below - 
	npm install async gm

2. Zip this file and node_modules using - 
	zip -9 -r ../createThumbnailAndStoreInDB-v1.0.zip *
	
3. Use Node.js 8.10 in lambda runtime ( Get this error otherwise -  
	"errorType": "TypeError",
    "errorMessage": "Cannot read property 'width' of undefined"

4. IAM Policy: CreateThumbnailAndStoreInDB
	{
		"Version": "2012-10-17",
		"Statement": [
			{
				"Effect": "Allow",
				"Action": [
					"s3:GetObject",
					"dynamodb:PutItem"
				],
				"Resource": [
					"arn:aws:s3:::xxxxxx-pictures/images/*",
					"arn:aws:dynamodb:eu-west-1:000000000:table/images"
				]
			},
			{
				"Effect": "Allow",
				"Action": "s3:PutObject",
				"Resource": "arn:aws:s3:::xxxxxx-pictures/thumbs/*"
			}
		]
	}

5. IAM Role: arn:aws:iam::000000000:role/lambda_createThumbnailAndStoreInDB should have below 2 policies
	CreateThumbnailAndStoreInDB (above managed policy)
	AWSLambdaBasicExecutionRole (AWS managed policy)

6. Lambda should be using this role lambda_createThumbnailAndStoreInDB

*/

// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.
var util = require('util');

// constants
var MAX_WIDTH  = 100;
var MAX_HEIGHT = 100;
var DDB_TABLE = 'images';

// get reference to S3 and dynamoDB clients
var s3 = new AWS.S3();
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context, callback) {
	
    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
    var srcBucket = event.Records[0].s3.bucket.name;
    
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey    = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    var dstBucket = srcBucket;
    var dstKey    = srcKey.replace("images", "thumbs");

    // Infer the image type.
    var typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        callback("Could not determine the image type.");
        return;
    }
    var imageType = typeMatch[1].toLowerCase();
    if (imageType != "jpg" && imageType != "png") {
        callback('Unsupported image type: ${imageType}');
        return;
    }

    // Download the image from S3, transform, and upload to a different S3 bucket.
    async.waterfall(
    	[
        	function download(next) {
            	// Download the image from S3 into a buffer.
            	s3.getObject({
                    Bucket: srcBucket,
                    Key: srcKey
                },
                next);
            },
			
        	function transform(response, next) {
            	gm(response.Body).size(function(err, size) {
            		var metadata = response.Metadata; 
					console.log("Metadata: \n", util.inspect(metadata, {depth: 5}));
					
	               // Infer the scaling factor to avoid stretching the image unnaturally.
    	            var scalingFactor = Math.min(
        	            MAX_WIDTH / size.width,
            	        MAX_HEIGHT / size.height
                	);
                	var width  = scalingFactor * size.width;
                	var height = scalingFactor * size.height;

	                // Transform the image buffer in memory.
    	            this.resize(width, height).toBuffer(imageType, function(err, buffer) {
                        if (err) {
                            next(err);
                        } else {
                            next(null, response.ContentType, metadata, buffer);
                        }
                    });
            	});
        	},
			
        	function upload(contentType, metadata, data, next) {
            	// Stream the transformed image to a different S3 bucket.
            	s3.putObject({
                	Bucket: dstBucket,
                	Key: dstKey,
                	Body: data,
                	ContentType: contentType,
                	Metadata: metadata
            	},
            	next (null, metadata));
        	},
			
        	function storeMetaData(metadata, next) {
				// adds metadata to DynamoDB
				var params = {
					TableName: DDB_TABLE,
					Item: {
						name: { S: srcKey },
						thumbnail: { S: dstKey },
						timestamp: { S: (new Date().toJSON()).toString() },
					}
				};
				if ('author' in metadata) {
					params.Item.author = { S: metadata.author};
				}
				if ('title' in metadata) {
					params.Item.title = { S: metadata.title};
				}
				if ('description' in metadata) {
					params.Item.description = { S: metadata.description};
				}
				dynamodb.putItem(params, next);
			}
    	], 
        function (err) {
            if (err) {
                console.error(
                    'Unable to resize ' + srcBucket + '/' + srcKey + ' and upload to ' + dstBucket + '/' + dstKey +
                    ' due to an error: ' + err
                );
            } else {
                console.log(
                    'Successfully resized ' + srcBucket + '/' + srcKey + ' and uploaded to ' + dstBucket + '/' + dstKey 
                );
            }

            callback(null, "message");
        }
    );
};
