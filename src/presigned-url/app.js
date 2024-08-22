import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let clientUrl;

const createPresignedUrlWithClient = ({ key }) => {
  const client = new S3Client({ region: process.env.AWS_REGION });
  const command = new PutObjectCommand({ Bucket: process.env.FILES_BUCKET_NAME, Key: key });
  return getSignedUrl(client, command, { expiresIn: 180 });
};

export const handler = async (event) => {
  let response;
  try{
    const { key } = event['queryStringParameters'];
    clientUrl = await createPresignedUrlWithClient({ key });
    response = {
      statusCode: 200,
      body: JSON.stringify({
        "s3-url": clientUrl
      })
    };
  }
  catch(err){
    console.log(err);
  }
  
  return response;
};
