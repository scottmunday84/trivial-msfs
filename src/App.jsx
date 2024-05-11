import React, {useCallback, useEffect, useMemo, useState} from "react";
import ReactMarkdown from "react-markdown";
import {io} from "socket.io-client";
import {
    AppBar,
    BottomNavigation,
    Box,
    Card,
    Container,
    createTheme,
    CssBaseline,
    Fade,
    Grow,
    lighten,
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

const CONNECTION_CONNECTED = 0;
const CONNECTION_DISCONNECTED = 1;
const CONNECTION_ERROR = -1;

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

const FactItem = ({description, images}) => {
    const width = 300;

    return (
        <Card sx={{width: '100%'}}>
            <Stack direction="row">
                <Typography variant="body1" sx={{padding: 2, flex: '1'}}>
                    <ReactMarkdown>{description}</ReactMarkdown>
                </Typography>
                {images.length > 0 && (
                    <Paper sx={{padding: 1, backgroundColor: theme => lighten(theme.palette.background.default, 0.05)}}>
                        <Stack direction="row" gap={1} alignItems="flex-start"
                               alignContent="flex-start" flexWrap="wrap" sx={{width: `${width * 2 + 8}px`}}>
                            {images.map((url, index) => (
                                <Fade key={index} in timeout={2000}>
                                    <img alt="..."
                                         src={url}
                                         style={{width, objectFit: 'contain'}} />
                                </Fade>
                            ))}
                        </Stack>
                    </Paper>)}
            </Stack>
        </Card>);
}

const App = (callback, deps) => {
    const [connected, setConnected] = useState(CONNECTION_DISCONNECTED);
    const [socket, setSocket] = useState(null);

    // Facts
    const [location, setLocation] = useState(null);
    const [facts, setFacts] = useState([]);

    useEffect(() => {
        const socket = io(window.location.host, {forceNew: true});

        socket.on('connect', () => {
            setConnected(CONNECTION_CONNECTED);
        });
        socket.on('disconnect', () => {
            setLocation(null);
            setFacts([]);
            setConnected(CONNECTION_DISCONNECTED);
        });
        socket.on('connect_error', error => {
            setConnected(CONNECTION_ERROR);
            console.error(error);
        });
        socket.on('send location', setLocation);
        socket.on('send facts', setFacts);
        setSocket(socket);
    }, []);
    const doneReading = useCallback(() => {
        setLocation(null);
        setFacts([]);
        socket.emit('done reading');
    }, [socket]);
    const hasLocation = useMemo(() => location !== null, [location]);
    const isReading = useMemo(() => facts.length > 0, [facts]);

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
                                }}>
                                {location}
                            </Typography>
                        </Fade>
                    </Toolbar>
                </Container>
            </AppBar>
            <Stack gap={2} alignItems="flex-end" sx={{padding: '10px'}}>
                <List sx={{width: '100%', padding: 8}}>
                    {facts.map(({description, images}, key) => (
                        <ListItem key={key}>
                            <Grow timeout={3000}>
                                <FactItem description={description} images={images} />
                            </Grow>
                        </ListItem>
                    ))}
                </List>
                <Paper sx={{position: 'fixed', bottom: 0, left: 0, right: 0}} elevation={3}>
                    <BottomNavigation>
                        <Box sx={{padding: '5px'}}>
                            <ConnectedIcon connected={connected}/>
                        </Box>
                        <Grow in={connected === CONNECTION_CONNECTED && isReading} timeout={3000} unmountOnExit>
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