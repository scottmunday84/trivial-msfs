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
    const buildFact = description => ({description, title: `${location} statistics`});
    const parseJsonFacts = json => JSON.parse(json.replace(/^```json|```$/g, ''));
    const categories = ['geography', 'history', 'science', 'art', 'authors', 'books', 'music',
            'musicians', 'games', 'sports', 'leisure', 'famous buildings', 'celebrities', 'pop culture'];
    const queryGroups = [
        [
            parseJsonFacts,
            `You are an assistant that only provides responses in JSON without surrounding Markdown.`,
            `JSON format should be: {"description": "", "title": ""}`,
            `Title should be an accurate title to the description. Use only proper nouns, dates, and locations specific
            only to the description requested.`,
            `Write a tourism board brochure of the city at ${location}. This is the description property in the JSON
            object.`,
        ],
        [
            buildFact,
            `You are an assistant that only provides Markdown essay responses.`,
            `Get multiple statistics of the city at ${location}. Get population, life expectancy, access of Internet,
            literacy rate, GDP, ethnic groups, religions, languages,  imports, and exports. Population and GDP should
            include units. For ethnic groups, religions, languages, imports, and exports, also provide a percentage.`,
        ],
        [
            parseJsonFacts,
            `You are an assistant that only provides responses in JSON without surrounding Markdown.`,
            `JSON format should be a list with every fact found: [{"description": "", "title": ""}, ...]`,
            `Title should be an accurate title to the report. Use only proper nouns, dates, and locations specific
            only to the fact report.`,
            `Find ten facts about the city of ${location} in the following categories of ${categories.join(', ')} and 
            write it as a full page report. This is the description defined in the JSON format. Do not write duplicate 
            facts. Be as descriptive and specific as possible. Add names, dates, and locations to the report. Make 
            it interesting.`
        ]
    ];
    console.debug(queryGroups);

    // Run each query one at a time
    const responses = (await Promise.all(queryGroups.map(queryGroup => {
        const [parse, ...queries] = queryGroup;
        const url = `${baseUrl}/chat/completions/`;
        const requestBody = {
            provider: 'OpenaiChat',
            model: 'gpt-4-gizmo',
            messages: queries.map(content => ({role: 'user', content}))
        };

        return axios.post(url, requestBody)
            .then(response => parse(response?.data?.choices?.[0]?.message?.content ?? undefined))
            .catch(exception => console.error(exception.message));
    })))
        .filter(response => response !== undefined)
        .flatMap(x => x);
    console.debug(responses);

    return responses;
}
const getImagesFromTitles = async (titles) => {
    const responses = (await Promise.all(titles.map(title => {
        const url = 'https://commons.wikimedia.org/w/api.php';
        const config = {
            params: {
                action: 'query',
                format: 'json',
                generator: 'search',
                gsrsearch: `${title} filetype:image`,
                gsrnamespace: 6,
                gsrlimit: 5,
                prop: 'imageinfo',
                iiprop: 'url'
            }
        };

        return axios.get(url, config)
            .then(response => Object
                .values(response?.data?.query?.pages ?? {})
                ?.map(image => image?.imageinfo?.[0]?.url ?? undefined) ?? undefined)
            .catch(exception => console.error(exception.message));
    })));
    console.debug(responses);

    return responses;
}

const onConnect = (socket, api) => {
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
            const location = await getLocationFromGeolocation(api);
            console.debug(location);
            socket.emit('send location', location);

            // Get dataset by location
            console.log(`Searching for dataset on ${location}.`);
            const {descriptions, titles} =
                (await getDataFromLocation(location)).reduce((acc, obj) => {
                    acc.descriptions.push(obj.description);
                    acc.titles.push(obj.title);

                    return acc;
                }, {descriptions: [], titles: []});
            const images = await getImagesFromTitles(titles);
            const facts = descriptions.map((description, index) =>
                ({description, images: images[index]}));
            socket.emit('send facts', facts);

            if (facts.length > 0) {
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

    // Run the MSFS API
    const api = new MSFS_API();

    await api.connect({
        autoReconnect: true,
        retries: Infinity,
        retryInterval: 10,
        onConnect: () => onConnect(socket, api),
        onException
    });
});

server.listen(3000, () => {
    console.log('Listening on *:3000. Have fun flying!!');
});
