const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

let users = [];

app.get('/users', (req, res) => {
    res.json(users);
});

app.post('/users', (req, res) => {
    const user = req.body;
    users.push(user);
    res.status(201).json(user);
});

// WebSocket
wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'geolocation') {
                const { latitude, longitude } = data.payload;

                // Ajoute les coordonnées au socket
                ws.latitude = latitude;
                ws.longitude = longitude;

                // Envoie la géolocalisation à tous les autres clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'geolocation',
                            id: ws._socket.remoteAddress, // Utiliser l'adresse IP comme identifiant unique
                            payload: { latitude, longitude }
                        }));
                    }
                });
            } else if (data.type === 'videoCallRequest') {
                const sender = ws;
                const payload = data.payload;
                const senderLatitude = payload.latitude;
                const senderLongitude = payload.longitude;

                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        const clientLatitude = client.latitude;
                        const clientLongitude = client.longitude;
                        if (client !== sender && clientLatitude && clientLongitude) {
                            client.send(JSON.stringify({ type: 'videoCallRequest', payload: { senderLatitude, senderLongitude } }));
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Invalid JSON message:', message);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
