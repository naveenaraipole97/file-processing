import { save_details } from './save_input_details';

const BASE_URL = `${process.env.REACT_APP_PRE_SIGNED_API_URL}/pre-signed-url`;

console.log(BASE_URL);

async function get_presigned_url(fileName){
    let queryParams = {
        key: fileName
    }

    const urlParams = new URLSearchParams(queryParams);
    const url = `${BASE_URL}?${urlParams}`;
    const response = await fetch(url, {
        method: 'GET',
        
    });
    const presignedUrlDetails = await response.json();
    return presignedUrlDetails;
}

async function s3_upload(presSignedUrl, fileToUpload){
  await fetch(presSignedUrl, {
      method: 'PUT',
      body: fileToUpload
  })
}

export const upload_file = async (textVal, fileName, fileToUpload) => {
    
  const res = await get_presigned_url(fileName)
  const awsS3DomainPattern = /^(.*?)\.s3\.[^\.]+\.amazonaws\.com/;

  let s3Url = res['s3-url'];
  if(URL.canParse(s3Url)) {
    s3Url = new URL(s3Url)
    const match = s3Url.hostname.match(awsS3DomainPattern);
    // Check if a match was found
    if (match) {
      const bucket = match[1]; // The portion before .s3.<region>.amazonaws.com
      await s3_upload(s3Url,fileToUpload);
      await save_details(textVal, `${bucket}/${fileName}`)
    } else {
      console.log('s3 url is not in valid format');
    }
    
  }else{
    console.log("Error generating presigned URL or parsing S3 URL");
  }
    
}