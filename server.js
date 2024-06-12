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

    socket.on('updateLocation', location => {
        socket.broadcast.emit('updateUsers', {
            id: socket.id,
            lat: location.lat,
            lon: location.lon
        });
    });

    socket.on('requestChat', targetUserId => {
        // Relay chat request to the targeted user
        io.to(targetUserId).emit('chatRequested');
    });

    socket.on('acceptChat', () => {
        // Handle chat acceptance logic here
        // For example, start a chat session between users
    });

    socket.on('declineChat', () => {
        // Handle chat decline logic here
        // For example, notify the requester
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
