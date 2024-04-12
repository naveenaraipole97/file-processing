import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';


export class PresignedUrlStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // s3-files-bucket
    // This is where we store input and output files
    const filesBucket = new s3.Bucket(this, 'FilesBucket', {
      bucketName: `${this.account}-${this.region}-file-uploads`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Remove bucket on stack deletion
      autoDeleteObjects: true, // Automatically delete objects when the bucket is removed
      accessControl: s3.BucketAccessControl.PRIVATE,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Define CORS rules to allow frontend to upload files
    filesBucket.addCorsRule({
      allowedOrigins: ['*'],
      allowedMethods: [
          s3.HttpMethods.PUT,
      ],
      allowedHeaders: ['*'], // Specify allowed headers
    });

    // Presigned Url Lambda
    // Purpose of this lambda is to generate presigned url for user file uploads
    const presignedUrlLambda = new nodejs.NodejsFunction(this, 'PresignedUrlLambda', {
      functionName: 'pre-signed-url-lambda',
      runtime: lambda.Runtime.NODEJS_20_X,
      projectRoot: path.join(__dirname, '../src/presigned-url'),
      entry: path.join(__dirname, '../src/presigned-url/app.js'),
      depsLockFilePath: path.join(__dirname, '../src/presigned-url/package-lock.json'),
      description: `Generates presigned URLs for file uploads s3 ${filesBucket.bucketName}`,
      logRetention: logs.RetentionDays.ONE_MONTH,
      handler: 'handler',
      bundling:{
        bundleAwsSDK: true,
      },
      environment: {
        FILES_BUCKET_NAME: filesBucket.bucketName,
      },
    })

    filesBucket.grantWrite(presignedUrlLambda);

    // API Gateway REST API to trigger lambda
    const httpApi = new apigatewayv2.HttpApi(this, 'PresignedUrlLambdaApi',{
      apiName: 'pre-signed-url-lambda-api',
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.GET],
      }
    });

    // Add a GET /pre-signed-url route that is integrated with the Lambda function
    httpApi.addRoutes({
      path: '/pre-signed-url',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('PreSignedUrlIntegration', presignedUrlLambda),
    });


    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      exportName: 'PreSignedApiUrl'
    });

    // Output the S3 bucket name
    new cdk.CfnOutput(this, 'BucketName', {
      value: filesBucket.bucketName,
    });

    // Output the S3 bucket arn fro instance profile
    new cdk.CfnOutput(this, 'BucketArn', {
      value: filesBucket.bucketArn,
      exportName: "FilesBucketArn"
    });
  }
}
