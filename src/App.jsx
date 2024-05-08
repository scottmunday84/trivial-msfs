import './App.css';
import {useEffect, useState} from "react";
import ReactMarkdown from "react-markdown";
import {io} from "socket.io-client";

export default function App() {
  const [data, setData] = useState([]);
  useEffect(() => {
    const socket = io();

    socket.on('send data', setData);
  }, []);

  return (
    <div className="App">
      <div>
          {console.log(data)}
          {data.map(result => (<ReactMarkdown source={result} />))}
      </div>
    </div>
  );
}
