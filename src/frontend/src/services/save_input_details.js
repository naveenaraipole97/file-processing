const backendApiUrl = `${process.env.REACT_APP_BACKEND_API_URL}/save`;

export async function save_details(inputText, inputFilePath){
    const body = {
      inputText: inputText,
      s3FilePath: inputFilePath
    }

    await fetch(backendApiUrl, {
      method: 'POST',
      body: JSON.stringify(body)    
    });
}

