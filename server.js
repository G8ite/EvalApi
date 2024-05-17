const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 3000;

// Servir les fichiers statiques du répertoire 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Exemple d'API RESTful (vous pouvez l'adapter selon vos besoins)
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

// Configuration du WebSocket
wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'geolocation') {
                // Gérer les messages de géolocalisation
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            } else if (data.type === 'videoCallRequest') {
                // Gérer les demandes de chat vidéo
                const sender = ws; // L'expéditeur de la demande
                const payload = data.payload;
                const senderLatitude = payload.latitude;
                const senderLongitude = payload.longitude;

                // Recherche du destinataire basée sur la position
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
