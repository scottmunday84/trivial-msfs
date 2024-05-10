import React, {useCallback, useEffect, useMemo, useState} from "react";
import ReactMarkdown from "react-markdown";
import {io} from "socket.io-client";
import {
    AppBar,
    BottomNavigation,
    Box,
    Card,
    CardActionArea,
    CardContent,
    CardMedia,
    Container,
    createTheme,
    CssBaseline,
    Fade,
    Grow,
    List,
    ListItem,
    Paper,
    Stack,
    Switch,
    ThemeProvider,
    Toolbar,
    Typography
} from "@mui/material";
import {FlightTakeoff, Power, PowerOff, RunningWithErrors} from "@mui/icons-material";
import "./App.css";

const ConnectedIcon = ({connected}) => {
    if (connected === CONNECTION_CONNECTED) {
        return (<Power color="success" fontSize="large"/>);
    }

    if (connected === CONNECTION_DISCONNECTED) {
        return (<PowerOff color="error" fontSize="large"/>);
    }

    if (connected === CONNECTION_ERROR) {
        return (<RunningWithErrors color="warning" fontSize="large"/>);
    }

    return null;
}

const CONNECTION_CONNECTED = 0;
const CONNECTION_DISCONNECTED = 1;
const CONNECTION_ERROR = -1;

const App = (callback, deps) => {
    const [location, setLocation] = useState();
    const [data, setData] = useState([]);
    const [images, setImages] = useState([]);
    const [connected, setConnected] = useState(CONNECTION_DISCONNECTED);
    const [socket, setSocket] = useState();

    useEffect(() => {
        const socket = io(window.location.host, {forceNew: true});

        socket.on('connect', () => {
            setConnected(CONNECTION_CONNECTED);
        });
        socket.on('disconnect', () => {
            setLocation(undefined);
            setData([]);
            setImages([]);
            setConnected(CONNECTION_DISCONNECTED);
        });
        socket.on('connect_error', error => {
            setConnected(CONNECTION_ERROR);
            console.error(error);
        });
        socket.on('send location', setLocation);
        socket.on('send data', (data, images) => {
            setData(data);
            setImages(images);
        });
        setSocket(socket);
    }, []);
    const doneReading = useCallback(() => {
        setLocation(undefined);
        setData([]);
        setImages([]);
        socket.emit('done reading');
    }, [socket]);
    const hasLocation = useMemo(() => location !== undefined, [location]);
    const isReading = useMemo(() => data.length > 0, [data]);

    const theme = createTheme({
        palette: {
            mode: 'dark'
        }
    });

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <AppBar>
                <Container maxWidth="xl">
                    <Toolbar disableGutters>
                        <FlightTakeoff sx={{display: {xs: 'none', md: 'flex'}, mr: 1}}/>
                        <Fade in={hasLocation} timeout={2000}>
                            <Typography
                                variant="h6"
                                noWrap
                                component="a"
                                href="#app-bar-with-responsive-menu"
                                sx={{
                                    mr: 2,
                                    display: {xs: 'none', md: 'flex'},
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    letterSpacing: '.3rem',
                                    color: 'inherit',
                                    textDecoration: 'none',
                                }}
                            >
                                {location}
                            </Typography>
                        </Fade>
                    </Toolbar>
                </Container>
            </AppBar>
            <Stack gap={2} alignItems="flex-end" sx={{padding: '10px'}}>
                <List sx={{width: '100%', padding: 8}}>
                    {data.map((input, key) => (
                        <ListItem key={key}>
                            <Grow in={true} timeout={3000}>
                                <Card sx={{width: '100%'}}>
                                    <CardActionArea>
                                        {images?.[key] && (<CardMedia component="img" height="140" image={images?.[key]} />)}
                                        <CardContent>
                                            <Typography variant="body2" sx={{padding: 2}}>
                                                <ReactMarkdown>{input}</ReactMarkdown>
                                            </Typography>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            </Grow>
                        </ListItem>
                    ))}
                </List>
                <Paper sx={{position: 'fixed', bottom: 0, left: 0, right: 0}} elevation={3}>
                    <BottomNavigation>
                        <Box sx={{padding: '5px'}}>
                            <ConnectedIcon connected={connected}/>
                        </Box>
                        <Grow in={connected === CONNECTION_CONNECTED && isReading} timeout={3000}>
                            <Box sx={{padding: '5px'}}>
                                <Switch onChange={doneReading} checked label="Reading"/>
                            </Box>
                        </Grow>
                    </BottomNavigation>
                </Paper>
            </Stack>
        </ThemeProvider>);
}

export default App;