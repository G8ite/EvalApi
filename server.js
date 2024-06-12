const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let users = {};

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
    console.log('New user connected:', socket.id);

    socket.on('updateLocation', location => {
        users[socket.id] = { id: socket.id, ...location };
        io.emit('updateUsers', Object.values(users));
    });

    socket.on('requestChat', targetId => {
        io.to(targetId).emit('chatRequested', socket.id);
    });

    socket.on('acceptChat', requesterId => {
        const room = `${requesterId}-${socket.id}`;
        socket.join(room);
        io.to(requesterId).emit('chatAccepted', { room, userId: socket.id });
        socket.emit('chatAccepted', { room, userId: requesterId });
    });

    socket.on('joinRoom', room => {
        socket.join(room);
    });

    socket.on('webrtcSignal', ({ target, signal }) => {
        io.to(target).emit('webrtcSignal', { signal, from: socket.id });
    });

    socket.on('hangupCall', room => {
        socket.leave(room);
        io.to(room).emit('hangupCall');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        io.emit('updateUsers', Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
