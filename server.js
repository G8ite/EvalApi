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
        io.to(targetUserId).emit('chatRequested', socket.id);
    });

    socket.on('userClicked', targetUserId => {
        io.to(targetUserId).emit('showModal', socket.id);
    });

    socket.on('acceptChat', (requesterId) => {
        io.to(requesterId).emit('chatAccepted', socket.id);
        io.to(socket.id).emit('chatAccepted', requesterId);
        io.emit('showModal', [requesterId, socket.id]);
    });

    socket.on('webrtcSignal', (data) => {
        const { target, signal } = data;
        io.to(target).emit('webrtcSignal', { signal, from: socket.id });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
