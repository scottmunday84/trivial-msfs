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

// Setting up functions used to perform actions
const getLocationFromGeolocation = async (api) => {
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

            return [city, state, country].join(', ');
        } catch (exception) {
            await new Promise(resolve => setTimeout(resolve, 15000));
        }
    }
}
const getDatasetFromLocation = async (location) => {
    const categories = [
        'geography', 'historical events', 'science', 'art', 'authors', 'musicians', 'games', 'sports', 'leisure',
        'famous buildings', 'celebrities', 'pop culture', 'interesting facts'];
    const queries = [
        `Get the city's name, state or province, township, and country from ${location}.`,
        `Get statistics on the city ${location} as one would find in the CIA's World Factbook. Get population, life 
        expectancy, access of Internet, literacy rate, GDP, ethnic groups, religions, languages,  imports, and exports. 
        Population and GDP should include units. For ethnic groups, religions, languages, imports, and exports, also 
        provide a percentage. Every percentage in statistics should be a decimal value no greater than 1.`,
        `Get heads of government for the city, county prosecutor, state or province, and country with their political 
        party affiliation of ${location}.`,
        `Write a detailed summary description of this city at ${location}.`,
        ...categories.map(category => `Find three to five facts of the city ${location} in ${category}. Write 
        descriptions per entry as an essay. Do not write duplicates. Be as descriptive and specific as possible. Add 
        proper names, dates, locations, and other identifiable information to each description. Develop an accurate 
        title to each description using only proper names, dates, and locations.`)];
    console.debug(queries);

    // Run each query one at a time
    const promises = queries.map(query => {
        const url = `${baseUrl}/chat/completions/`;
        const requestBody = {
            provider: 'OpenaiChat',
            model: 'gpt-3.5-turbo',
            messages: [{role: 'user', content: query}]
        };

        return axios.post(url, requestBody)
            .then(response => response.data.choices?.[0]?.message?.content ?? '')
            .catch(console.error);
    })
    const responses = await Promise.all(promises);
    console.debug(responses);

    return responses;
}

const onConnect = (socket, api) => {
    let isLive = true;
    console.log('Connected to MSFS SimConnect server.');

    const refreshGeolocationDataset = async () => {
        try {
            const location = await getLocationFromGeolocation(api);
            console.debug(location);

            // Get dataset by location
            console.log(`Searching for dataset on ${location}.`);
            const dataset = await getDatasetFromLocation(location);

            socket.broadcast.emit('send data', dataset);
        } catch (exception) {
            console.error(exception);
        }

        if (isLive) {
            setTimeout(refreshGeolocationDataset, 60000);
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
    console.log('A flyer connected.');

    // Run the API
    const api = new MSFS_API();

    await api.connect({
        autoReconnect: true,
        retries: Infinity,
        retryInterval: 5,
        onConnect: () => onConnect(socket, api),
        onException
    });
});

server.listen(3000, () => {
    console.log('Listening on *:3000. Have fun flying!!');
});
