const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

let users = {};

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', socket => {
    console.log('New user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        io.emit('updateUsers', Object.values(users));
    });

    socket.on('updateLocation', location => {
        users[socket.id] = { id: socket.id, ...location };
        io.emit('updateUsers', Object.values(users));
    });

    socket.on('requestChat', targetUserId => {
        io.to(targetUserId).emit('showModal', socket.id);
    });

    socket.on('userClicked', targetUserId => {
        io.to(targetUserId).emit('showModal', socket.id);
    });

    socket.on('acceptChat', (userIds) => {
        userIds.forEach(userId => {
            if (userId !== socket.id) { // Évitez de créer une connexion avec soi-même
                const newConnection = createPeerConnection(userId);
                connections.set(userId, newConnection);
            }
        });
        io.emit('startCall', userIds); // Émet un événement pour démarrer l'appel avec les utilisateurs concernés
    });

    socket.on('webrtcSignal', (data) => {
        const { target, signal } = data;
        io.to(target).emit('webrtcSignal', { signal, from: socket.id });
    });
});

function createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            io.to(userId).emit('webrtcSignal', { target: userId, signal: event.candidate });
        }
    };
    peerConnection.ontrack = event => {
        // Envoyer le flux vidéo reçu à l'utilisateur
        io.to(userId).emit('remoteStream', { stream: event.streams[0], userId: socket.id });
    };
    return peerConnection;
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
