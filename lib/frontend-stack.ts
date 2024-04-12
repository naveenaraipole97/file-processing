import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs-extra';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';
import { spawnSync, SpawnSyncOptions } from 'child_process';

export interface FrontendStackProps extends cdk.StackProps {
  preSignedUrlApi: string
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: FrontendStackProps) {
    super(scope, id, props);

    // s3-frontend-assets
    const frontendBucket = new s3.Bucket(this, 'StaticWebsiteBucket', {
      bucketName: `${this.account}-${this.region}-file-uploader-ui`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Remove bucket on stack deletion
      autoDeleteObjects: true, // Automatically delete objects when the bucket is removed
      accessControl: s3.BucketAccessControl.PRIVATE,
    });
    
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    frontendBucket.grantRead(originAccessIdentity);

    // Optional: Create a CloudFront distribution for the static site
    const distribution = new cloudfront.Distribution(this, 'FrontendSiteDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket,{originAccessIdentity}),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
    });


    const entry = path.join(__dirname, '../src/frontend')
    // Deploy the React app files from the `frontend` directory to the S3 bucket
    new s3deployment.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deployment.Source.asset(entry,{
        // Use CDK bundling to run `npm run build` in the frontend directory
        bundling: {
          local: {
            tryBundle(outputDir: string) {
              // make sure we have all the required
              // dependencies to build the site locally.
              // In this case we just check to make sure
              // we have npm installed
              try {
                exec('npm --version', {
                  stdio: [ // show output
                    'ignore', //ignore stdio
                    process.stderr, // redirect stdout to stderr
                    'inherit' // inherit stderr
                  ],
                });
              } catch {
                // if we don't have npm installed return false
                // which tells the CDK to try Docker bundling
                return false
              }

              try {
                exec(
                  [
                    'npm install',
                    'npm run build'
                  ].join(' && '),
                  {
                    env: { ...process.env, /*REACT_APP_API_URL:props?.preSignedUrlApi*/ }, // environment variables to use when running the build command
                    stdio: [ // show output
                      'ignore', //ignore stdio
                      process.stderr, // redirect stdout to stderr
                      'inherit' // inherit stderr
                    ],
                    cwd: entry // where to run the build command from, i.e. the directory where our nuxt.js app is located
                  }
                )

              } catch {
                return false
              }

              try {
                // copy the dist directory that is created with 'npm generate'
                // to the cdk outDir
                fs.copySync(path.join(entry, 'build'), outputDir);
              } catch {
                return false
              }

              return true
            },
          },
          image: cdk.DockerImage.fromRegistry('node:lts'),
          command: [
            'bash', '-c', [
              'npm install',
              /*`REACT_APP_API_URL=${props?.preSignedUrlApi}*/`npm run build`,
              'cp -r ./build/* /asset-output/',
            ].join(' && ')
          ],
        }
    })],
      destinationBucket: frontendBucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });


    // Output the CloudFront distribution domain name (if created)
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`
    });
  }
}

function exec(command: string, options?: SpawnSyncOptions) {
  const proc = spawnSync('bash', ['-c', command], options);

  if (proc.error) {
    throw proc.error;
  }

  if (proc.status != 0) {
    if (proc.stdout || proc.stderr) {
      throw new Error(`[Status ${proc.status}] stdout: ${proc.stdout?.toString().trim()}\n\n\nstderr: ${proc.stderr?.toString().trim()}`);
    }
    throw new Error(`exited with status ${proc.status}`);
  }

  return proc;
}