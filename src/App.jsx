import {useState} from "react";
import ReactMarkdown from "react-markdown";
import {io} from "socket.io-client";

const App = () => {
  const [data, setData] = useState([]);
  const socket = io();

  socket.on('send data', data => {
      console.log(data);
      setData(data);
  });

  return (
    <div className="App">
      <div>
          {data.map(input => (<ReactMarkdown>{input}</ReactMarkdown>))}
      </div>
    </div>
  );
}

export default App;