const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html from root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', socket => {
    console.log('New connection:', socket.id);

    socket.on('join-room', roomId => {
        console.log(`Socket ${socket.id} joining room ${roomId}`);
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('signal', ({ to, data }) => {
        io.to(to).emit('signal', { from: socket.id, data });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
