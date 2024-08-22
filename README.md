# Demo 
[Working demo](https://drive.google.com/file/d/1Jo9x24CxLVttQWeQcBsVCjLixGuRho4e/view?usp=sharing)

# Architecture
<img width="452" alt="image" src="https://github.com/naveenaraipole97/file_upload_app2/assets/144768728/732a3715-e052-4aca-b5d6-8658cc073b73">


# Steps to deploy and run:
- [Install node lts V20 for your machine](https://nodejs.org/en/download)
- Install CDK `npm install -g aws-cdk`
- [Install Docker](https://docs.docker.com/engine/install/) 
- [Install VS Code](https://code.visualstudio.com/download) (if not already installed)
- Create a IAM user profile on your AWS account with administrator access
- Create a access key for the IAM user
- [Install AWS Cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Configure AWS Cli](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) with IAM user credentials (Access Key and Secret Access Key)
- prefer using short-term-creds by running `aws sts get-session-token` and configuring aws cli with the returned credentials
- [Clone repo](https://github.com/naveenaraipole97/file_upload_app2.git) and open in VS Code
- Bootstrap your account. This is one-time action that you must perform for every environment that you deploy resources into.(eg when you want to deploy to new account or new env). This will create required resources for CDK to deploy stacks
- cdk bootstrap aws://ACCOUNT-NUMBER-1/REGION-1
- Start docker this is required to install node modules during deploy
- set AWS_PROFILE env var which has admin access (`export AWS_PROFILE=<awsprofile with admin access>`)
- Now deploy resources `npm run cdk-deploy`. This will create CF stacks one after another
- click on `FrontendStack.CloudFrontURL` from frontend stack outputs you should see the frontend loaded 
- Now upload file and add input text verify you can see those details in FileTable
- After sometime lambda will kick off new workers which will process the file and create new output file verify that outfile exists in s3 and new field is added to dynamo table item


## Stacks and their resources

### frontend-stack
- Purpose of this stack is to serve frontend content via S3 and CloudFront
- It has one s3 bucket(`${this.account}-${this.region}-file-uploader-ui`) to store frontend code and this code gets bundled during synth stage 

### presigned-url-stack
- Purpose of this stack is to create pre signed url for uploading files to s3 `${this.account}-${this.region}-file-uploads`
- It has one lambda function to generate pre signed url for uploading files to s3
- It has api gateway to expose lambda function as http api endpoint

### backend-stack
- Purpose of this stack is to add input file path and input text sent from frontedn to dynamodb
- It has one dynamodb table(`FileTable`) to store input file path and text
- It has one lambda function to add item to dynamodb table on http request from API Gateway

### worker-stack
- Purpose of this stack is to trigger ec2 workers that can process files uploaded to S3. i.e to get s3 input file and append input text to its content and store that new data in output file all output files follow naming convention of `output_<input_file_name>` and also add this path to `FileTable` dynamo
- It has one lambda function that gets triggered on Dynamodb change events. This function will start ec2 worker with item id that is inserted to table
- It has one S3 bucket to store scripts (`${this.account}-${this.region}-scripts`)
