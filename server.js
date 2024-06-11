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
    console.log('New user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
        delete users[socket.id];
        io.emit('updateUsers', Object.values(users));
    });

    socket.on('updateLocation', location => {
        users[socket.id] = location;
        io.emit('updateUsers', Object.values(users));
    });

    socket.on('startChat', targetUserId => {
        const targetSocket = io.sockets.connected[targetUserId];
        if (targetSocket) {
            targetSocket.emit('chatRequest', socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
