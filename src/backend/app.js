import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

const client = new DynamoDBClient({region:process.env.AWS_REGION});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  let result, response;
  try {
    const {inputText,s3FilePath} = JSON.parse(event['body']);
    if (!inputText || !s3FilePath){
      response = {
        statusCode: 400,
        body: JSON.stringify({message: 'inputText and s3FilePath are required'})
      }
    }else{
      const command = new PutCommand({
        TableName: process.env.FILES_TABLE,
        Item: {
          id: nanoid(16), //use nano ID
          input_text: inputText,
          input_file_path: s3FilePath,
        },
      });
      
      try{
        result = await docClient.send(command);
        console.log(result);
      }
      catch(err){
        console.log("error adding item to dynamodb")
        console.log(err);
      }
      response = {
        statusCode: result["$metadata"]["httpStatusCode"],
        body: result["$metadata"]["requestId"]
      };
    }
  } catch (error) {
    response = {
      statusCode: 500,
      body: JSON.stringify({message: 'Unable to save input details. Internal server error'})
    }
  }
  
  return response;
 
};
