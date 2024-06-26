const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs').promises;
const admin = require('firebase-admin');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Async function to read the config
async function getConfig() {
    try {
        const data = await fs.readFile('./key.json', 'utf-8'); // Adjust path if necessary
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error('Configuration file "key.json" not found.');
        } else {
            console.error('Error reading configuration file:', error);
        }
        process.exit(1); // Exit if the configuration cannot be read
    }
}

// Initialize Firebase Admin SDK
const serviceAccount = require('./key.json'); // Update with your service account key path
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://your-project-id.firebaseio.com' // Replace with your database URL
});
const db = admin.firestore();

// Last.fm API configuration
const LAST_FM_API_KEY = 'cdc20bee3f132be698df67f35be5b221'; // Replace with your Last.fm API key
const LAST_FM_API_URL = 'http://ws.audioscrobbler.com/2.0/';

// Function to search for artist details using Last.fm API
async function searchArtistDetails(artistName) {
    try {
        const response = await axios.get(LAST_FM_API_URL, {
            params: {
                method: 'artist.getInfo',
                artist: artistName,
                api_key: LAST_FM_API_KEY,
                format: 'json'
            }
        });

        if (response.data.error) {
            throw new Error(response.data.message);
        }

        const artist = response.data.artist;
        return {
            name: artist.name,
            genre: artist.tags.tag[0].name,
            bio: artist.bio.summary
        };
    } catch (error) {
        console.error('Error fetching artist details:', error.message);
        return null;
    }
}

// Define routes
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userSnapshot = await db.collection('users').where('username', '==', username).get();
        if (userSnapshot.empty) {
            return res.render('login', { error: 'Invalid username or password' });
        }
        const user = userSnapshot.docs[0].data();
        if (user.password === password) {
            res.redirect('/artist');
        } else {
            res.render('login', { error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.render('login', { error: 'Something went wrong. Please try again.' });
    }
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        await db.collection('users').add({ username, password });
        res.redirect('/login');
    } catch (error) {
        console.error('Error signing up:', error);
        res.render('signup', { error: 'Something went wrong. Please try again.' });
    }
});

app.get('/artist', (req, res) => {
    res.render('artist', { artist: null, error: null });
});

app.get('/artist/details', async (req, res) => {
    const artistName = req.query.artistName;
    console.log(`Searching for artist: ${artistName}`);
    
    // Lookup artist details using Last.fm API
    const artist = await searchArtistDetails(artistName);
    if (artist) {
        res.render('artist', { artist, error: null });
    } else {
        res.render('artist', { artist: null, error: "Artist not found. Please check the spelling or try another artist." });
    }
});

// Start the server after reading the configuration
getConfig().then(config => {
    const port = config.port || 3000;
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
});
