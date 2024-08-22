import { useState } from 'react';
import './App.css';
import { upload_file } from './services/s3_upload';

function App() {
  const [textValue, setTextValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileToUpload, setFileToUpload] = useState("");

  const textValueChange = event => {
    setTextValue(event.target.value);
  }
  
  const onFileUpload = event => {
    setFileToUpload(event.target.files[0]);
    setFileName(event.target.files[0]['name']);
  }


  const onSubmit = async (e) => {
    try {
      await upload_file(textValue, fileName, fileToUpload);
      alert("🎉 inputFile uploaded to S3 sucessfully!");
    } catch (error) {
      console.log(error)
      alert("error uploading file")
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <label>
          Text input: <input onChange={textValueChange}/>
        </label>
        
        <label>
          File input: <input type="file" onChange={onFileUpload}/>
        </label>
        
        <button onClick={onSubmit} disabled={textValue === "" || fileToUpload === ""}>Submit</button>
      </header>
    </div>
  );
}

export default App;
