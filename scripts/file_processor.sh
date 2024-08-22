#!/bin/bash

# Downloads an input file from S3 based on item data in DynamoDB,
# appends additional text to it, uploads the output file back to S3,
# updates the DynamoDB item with the output file path,
# and terminates the EC2 instance that ran the processing.

set -e
table_name=$1
item_id=$2
if [[ -n $item_id && -n $table_name ]]; then
  # get item from dynamo
  item=$(
    aws dynamodb get-item \
      --table-name "$table_name" \
      --key '{"id": {"S": "'"$item_id"'"}}' \
      --output json
  )
  echo "Dynamo Get Item Response: $item"
  item_text=$(echo "$item" | jq -r .Item.input_text.S)
  input_file_path=$(echo "$item" | jq -r .Item.input_file_path.S)
  # get s3 bucket name and file name
  s3_bucket=$(echo "$input_file_path" | cut -d "/" -f 1)
  input_file_name=$(echo "$input_file_path" | cut -d "/" -f 2)
  # download input file
  aws s3 cp "s3://$input_file_path" /tmp/output_file.txt
  # append input text in new line
  echo -e "\n$item_text" >>/tmp/output_file.txt
  # upload outfile to s3
  output_file_path="$s3_bucket/output_$input_file_name"
  aws s3 cp /tmp/output_file.txt "s3://$output_file_path"
  # add output_file_path to dynamo
  aws dynamodb update-item \
    --table-name "$table_name" \
    --key '{"id": {"S": "'"$item_id"'"}}' \
    --update-expression "SET #output_file_path = :output_file_path_value" \
    --expression-attribute-names '{"#output_file_path": "output_file_path"}' \
    --expression-attribute-values '{":output_file_path_value": {"S": "'"$output_file_path"'"}}'
  # remove outputfile
  rm /tmp/output_file.txt
  #terminate ec2 instance
  instance_id=$(ec2-metadata -i | cut -d ":" -f 2 | tr -d " ")
  if [[ -n "$instance_id" && "$instance_id" != "None" ]]; then
    aws ec2 terminate-instances --instance-ids "$instance_id"
    echo "Instance with ID $instance_id terminated."
  else
    echo "No instance found with the specified instance id."
  fi
else
  echo "[ERROR] item_id or table_name is missing in input arg"
  echo "Usage: $0 <table_name> <item_id>"
  exit 1
fi

