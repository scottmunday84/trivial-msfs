import React, {useCallback, useEffect, useState} from "react";
import ReactMarkdown from "react-markdown";
import {io} from "socket.io-client";
import {
    BottomNavigation, Box,
    createTheme,
    CssBaseline,
    Grow,
    List,
    ListItem,
    Paper,
    Stack, Switch,
    ThemeProvider,
    Typography
} from "@mui/material";
import {Power, PowerOff, RunningWithErrors} from "@mui/icons-material";
import "./App.css";

const ConnectedIcon = ({connected}) => {
    if (connected === CONNECTION_CONNECTED) {
        return (<Power color="success" fontSize="large" />);
    }

    if (connected === CONNECTION_DISCONNECTED) {
        return (<PowerOff color="error" fontSize="large" />);
    }

    if (connected === CONNECTION_ERROR) {
        return (<RunningWithErrors color="warning" fontSize="large" />);
    }

    return null;
}

const CONNECTION_CONNECTED = 0;
const CONNECTION_DISCONNECTED = 1;
const CONNECTION_ERROR = -1;

const App = (callback, deps) => {
  const [data, setData] = useState([]);
  const [connected, setConnected] = useState(CONNECTION_DISCONNECTED);
  const [socket, setSocket] = useState();
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
      const socket = io(window.location.host, {forceNew: true});

      socket.on('connect', () => {
          setConnected(CONNECTION_CONNECTED);
      });
      socket.on('disconnect', () => {
          setConnected(CONNECTION_DISCONNECTED);
      });
      socket.on('connect_error', error => {
          setConnected(CONNECTION_ERROR);
          console.error(error);
      });
      socket.on('send data', data => {
          setData(data);
          setIsReading(true);
      });
      setSocket(socket);
  }, []);

    const doneReading = useCallback(() => {
        socket.emit('done reading');
    }, [socket]);

    const theme = createTheme({
      palette: {
          mode: 'dark'
      }
  });

  return (
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <Stack gap={2} alignItems="flex-end" sx={{padding: '10px'}}>
            <List sx={{width: '100%', marginBottom: '56px'}}>
                {data.map((input, key) => (
                    <ListItem key={key}>
                        <Grow in={true} timeout={3000}>
                            <Paper elevation={1} sx={{padding: '5px', width: '100%'}}>
                                <Typography variant="body1">
                                    <ReactMarkdown>{input}</ReactMarkdown>
                                </Typography>
                            </Paper>
                        </Grow>
                    </ListItem>
                ))}
            </List>
            <Paper sx={{position: 'fixed', bottom: 0, left: 0, right: 0}} elevation={3}>
                <BottomNavigation>
                    <Box sx={{padding: '5px'}}>
                        <ConnectedIcon connected={connected} />
                    </Box>
                    <Grow in={connected === CONNECTION_CONNECTED && isReading} timeout={3000}>
                        <Box sx={{padding: '5px'}}>
                            <Switch onChange={doneReading} defaultChecked label="Reading" />
                        </Box>
                    </Grow>
                </BottomNavigation>
            </Paper>
        </Stack>
    </ThemeProvider>);
}

export default App;