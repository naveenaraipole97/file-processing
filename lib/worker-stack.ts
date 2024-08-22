import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export class WorkerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

      // Create an S3 bucket
      const scriptsBucket = new s3.Bucket(this, 'FilesBucket', {
        bucketName: `${this.account}-${this.region}-scripts`,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Remove bucket on stack deletion
        autoDeleteObjects: true, // Automatically delete objects when the bucket is removed
        accessControl: s3.BucketAccessControl.PRIVATE,
        publicReadAccess: false,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        versioned: true,
        lifecycleRules: [
          {
            noncurrentVersionExpiration: cdk.Duration.days(30)
          }
        ]
      });

      // sync scripts to s3
      const scriptName = "file_processor.sh"
      new s3deployment.BucketDeployment(this, 'SyncScripts', {
        sources: [s3deployment.Source.asset(path.join(__dirname,'../scripts/'))],
        destinationBucket: scriptsBucket,
      });


      // Create EC2 intance profile
      // Read and write to file table
      // Read and write to uploader bucket
      // Read from scripts bucket
      const fileTableArn = cdk.Fn.importValue('FileTableArn');
      const fileTableStreamArn = cdk.Fn.importValue('FileTableStreamArn');
      const filesBucketArn = cdk.Fn.importValue('FilesBucketArn');

      // Create an IAM role for the EC2 instance profile
      const instanceRole = new iam.Role(this, 'InstanceRole', {
        roleName:"file-processor-role",
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      });

      instanceRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "fileTableRw",
          actions: ['dynamodb:GetItem', 'dynamodb:Query','dynamodb:UpdateItem'],
          resources: [fileTableArn],
        })
      );

      instanceRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "fileBucketRw",
          actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
          resources: [filesBucketArn, `${filesBucketArn}/*`]
        })
      );

      instanceRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "scriptsBucketRo",
          actions: ['s3:GetObject'],
          resources: [`${scriptsBucket.bucketArn}/${scriptName}`]
        })
      );

      instanceRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "scriptsBucketRo",
          actions: ['s3:GetObject'],
          resources: [`${scriptsBucket.bucketArn}/${scriptName}`]
        })
      );

      instanceRole.addToPolicy(
        new iam.PolicyStatement({
          sid: "terminateSelf",
          actions: [
            "ec2:DeleteTags",
            "ec2:DescribeTags",
            "ec2:CreateTags",
            "ec2:TerminateInstances",
            "ec2:StopInstances",
            "ec2:Describe*"
          ],
          resources: [`arn:aws:ec2:${this.region}:${this.account}:*`],
        })
      );

      // Create an EC2 instance profile with the IAM role
      const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
        instanceProfileName: "file-processor",
        roles: [instanceRole.roleName],
      });


      // Create Worker lambda
      const workerLambda = new nodejs.NodejsFunction(this, 'WorkerLambda', {
        functionName: 'worker-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        projectRoot: path.join(__dirname, '../src/worker'),
        description: `Worker to download input file and append input text, upload output file and save output path in dynamo`,
        logRetention: logs.RetentionDays.ONE_MONTH,
        handler: 'handler',
        entry: path.join(__dirname, '../src/worker/app.js'),
        depsLockFilePath: path.join(__dirname, '../src/worker/package-lock.json'),
        bundling:{
          bundleAwsSDK: true,
        },
        environment: {
          SCRIPTS_S3_BUCKET:scriptsBucket.bucketName,
          SCRIPT_PATH:scriptName,
          EC2_INSTANCE_PROFILE_ARN:instanceProfile.attrArn,
          FILES_TABLE: cdk.Fn.importValue("FileTableName"),
        },
      })

      // Grant permissions to create ec2 instances
      workerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ec2:RunInstances','ec2:CreateTags'],
          resources: [
            `arn:aws:ec2:${this.region}:${this.account}:*`,
            `arn:aws:ec2:${this.region}::*`,//for ami
          ],
        })
      );


      workerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [instanceRole.roleArn],
        })
      );

      workerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'dynamodb:ListStreams', 
            'dynamodb:DescribeStream',
            'dynamodb:GetRecords',
            'dynamodb:GetShardIterator',
          ],
          resources: [fileTableStreamArn],
        })
      );

      workerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "lambda:InvokeFunction"
          ],
          resources: ["*"],
        })
      );

      workerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "ssm:GetParameters"
          ],
          resources: [`arn:aws:ssm:${this.region}::parameter/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`],
        })
      );

      workerLambda.addEventSourceMapping("WorkerLambdaDynamoEsm",{
        eventSourceArn: fileTableStreamArn,
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
      });

  }
}
