import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';


export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // s3-files-bucket
    // This is where we store input and output files
    const fileTable = new dynamodb.Table(this, 'FileTable', {
      tableName: 'FileTable',
      deletionProtection: false,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
    },
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Enable DynamoDB streams
    });


    // backend Lambda
    // Purpose of this lambda is to put items in dynamo i.e file_path and input_text
    const backendLambda = new lambda.Function(this, 'BackendLambda', {
      functionName: 'backend-lambda',
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/backend')),
      description: `Lambda to put items in to DynamoDB Table`,
      logRetention: logs.RetentionDays.ONE_MONTH,
      handler: 'app.handler',
      environment: {
        FILES_TABLE: fileTable.tableName,
      },
    })

    fileTable.grantWriteData(backendLambda);

    // API Gateway REST API to trigger lambda
    const httpApi = new apigatewayv2.HttpApi(this, 'BackendLambdaApi',{
      apiName: 'backend-lambda-api',
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.GET],
      }
    });

    // Add a POST /save route that is integrated with the Lambda function
    httpApi.addRoutes({
      path: '/save',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('BackendIntegration', backendLambda),
    });


    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      exportName: 'BackendApiUrl'
    });

    // Output the File table name
    new cdk.CfnOutput(this, 'TableName', {
      value: fileTable.tableName,
      exportName: 'FileTableName'
    });

    // Output the file table arn for ec2 instance profile
    new cdk.CfnOutput(this, 'TableArn', {
      value: fileTable.tableArn,
      exportName: 'FileTableArn'
    });

    // Output the dynamo stream arn for ec2 instance profile
    new cdk.CfnOutput(this, 'DynamoStreamArn', {
      value: fileTable.tableStreamArn || "",
      exportName: 'FileTableStreamArn'
    });
  }
}
