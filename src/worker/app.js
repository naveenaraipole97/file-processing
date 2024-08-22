import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";

const ec2Client = new EC2Client({region: process.env.AWS_REGION});

const insertEvent = 'INSERT';

export const handler = async (event) => {
  try {
    for (let i = 0; i < event.Records.length; i++) {
      const eventRecord = event.Records[i];
      if(eventRecord['eventName']!=insertEvent){
        continue;
      } else{
        const itemId = eventRecord['dynamodb']['NewImage']['id']['S'];
        if (itemId){
          const userDataScript = `#!/bin/bash\nsu ec2-user -c 'aws s3 cp s3://${process.env.SCRIPTS_S3_BUCKET}/${process.env.SCRIPT_PATH} /tmp/file_processor.sh && bash /tmp/file_processor.sh ${process.env.FILES_TABLE} ${itemId}'`;
          const params = {
            ImageId: 'resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64',
            InstanceType: 't2.micro',
            IamInstanceProfile: {
              Arn: process.env.EC2_INSTANCE_PROFILE_ARN
            },
            MinCount: 1,
            MaxCount: 1,
            UserData: Buffer.from(userDataScript).toString('base64'), 
            TagSpecifications: [
              {
                'ResourceType': 'instance',
                'Tags': [
                  {
                    "Key": "Group",
                    "Value": "file_processor"
                  },
                  {
                    "Key": "Name",
                    "Value": itemId
                  }
                ]
              }
            ]
          };
          const command = new RunInstancesCommand(params);
          const data = await ec2Client.send(command);
          console.log(data);
        }
      }
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};
