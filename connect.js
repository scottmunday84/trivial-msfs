import axios from "axios";
import http from "http";
import express from "express";
import {MSFS_API} from "msfs-simconnect-api-wrapper";
import {Server} from "socket.io";

// LocationIQ
const geoToken = 'pk.59ee0e5aafa88b89c6e1151f8ff0d03d';
const geoUrl = 'https://us1.locationiq.com/v1';

// OpenAI (free) setup
const baseUrl = 'http://localhost:1337/v1';

// Run the MSFS API
const api = new MSFS_API();

// Setting up functions used to perform actions
const getLocationFromGeolocation = async () => {
    const radiansToDegrees = radians => radians * (180 / Math.PI);

    while (true) {
        try {
            const {PLANE_LATITUDE: latitude, PLANE_LONGITUDE: longitude} = await api.get('PLANE_LATITUDE', 'PLANE_LONGITUDE');
            const [lat, lon] = [radiansToDegrees(latitude), radiansToDegrees(longitude)];
            console.debug(lat, lon);

            const {data: {address: {city, state, country}}} = await axios.get(`${geoUrl}/reverse`, {
                params: {
                    key: geoToken,
                    lat,
                    lon,
                    format: 'json'
                }
            });

            if (city === undefined) {
                throw new Error();
            }

            return [city, state, country].join(', ');
        } catch (exception) {
            await new Promise(resolve => setTimeout(resolve, 15000));
        }
    }
}
const getDataFromLocation = async (location) => {
    const categories = [
        'geography', 'historical events', 'science', 'art', 'authors', 'musicians', 'games', 'sports', 'leisure',
        'famous buildings', 'celebrities', 'pop culture', 'interesting facts'];
    const queries = [
        `Get the approximate city's name, state or province, township, and country of the city at ${location}.`,
        `Write a detailed summary description of the city at ${location}. Provide as Markdown.`,
        `Get statistics of the city at ${location}. Get population, life expectancy, access of Internet, literacy rate, ` +
        `GDP, ethnic groups, religions, languages,  imports, and exports. Population and GDP should include units. `  +
        `For ethnic groups, religions, languages, imports, and exports, also provide a percentage. Provide as Markdown.`,
        ...categories.map(category => `Find one to three facts of the city at ${location} in ${category}. ` +
        `Write descriptions per entry as an essay. Do not write duplicates. Be as descriptive and specific as ` +
        `possible. No generalities. Add proper names, dates, locations, and other identifiable information to each ` +
        `description in an essay format. Develop an accurate title to each description using only proper names, ` +
        `dates, and locations. Provide as Markdown.`)];
    console.debug(queries);

    // Run each query one at a time
    const responses = (await Promise.all(queries.map(query => {
        const url = `${baseUrl}/chat/completions/`;
        const requestBody = {
            provider: 'OpenaiChat',
            model: 'gpt-3.5-turbo',
            messages: [{role: 'user', content: query}]
        };

        return axios.post(url, requestBody)
            .then(response => response?.data?.choices?.[0]?.message?.content ?? null)
            .catch(exception => console.error(exception.message));
    }))).filter(response => response !== undefined);
    console.debug(responses);

    return responses;
}

const onConnect = socket => {
    let isReading = false;
    let isLive = true;
    console.log('Connected to MSFS SimConnect server.');

    // Handle reading toggle
    socket.on('done reading', () => {
        console.log('No longer reading; find new location of data.');
        isReading = false;
    });

    const refreshGeolocationDataset = async () => {
        if (isReading) {
            setTimeout(refreshGeolocationDataset, 5000);  // Let me read!!

            return;
        }

        try {
            const location = await getLocationFromGeolocation();
            console.debug(location);

            // Get dataset by location
            console.log(`Searching for dataset on ${location}.`);
            const data = await getDataFromLocation(location);

            socket.emit('send data', data);

            if (data.length > 0) {
                isReading = true;
            }
        } catch (exception) {
            console.error(exception.message);
        } finally {
            if (isLive) {
                setTimeout(refreshGeolocationDataset, 30000);
            }
        }
    }
    refreshGeolocationDataset().then();

    return () => isLive = false;
};

const onException = exception => {
    console.error(exception);
}

// Setup server communication for socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));

io.on('connection', async (socket) => {
    console.log('A flyer connected. Zoom, zoom!!');

    await api.connect({
        autoReconnect: true,
        retries: Infinity,
        retryInterval: 10,
        onConnect: () => onConnect(socket),
        onException
    });
});

server.listen(3000, () => {
    console.log('Listening on *:3000. Have fun flying!!');
});
