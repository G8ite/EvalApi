const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express(); // Initialisation de l'application Express
const server = http.createServer(app); // Création du serveur HTTP à partir de l'application Express
const io = socketIo(server); // Initialisation de Socket.IO avec le serveur HTTP

const PORT = process.env.PORT || 3000; // Définition du port du serveur

let users = {}; // Stockage des utilisateurs connectés
let rooms = new Map(); // Stockage des rooms pour les appels

// Middleware pour servir les fichiers statiques du dossier 'public'
app.use(express.static('public'));

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html'); // Envoi du fichier HTML de la page d'accueil
});

// Gestionnaire d'événements pour la connexion des utilisateurs via Socket.IO
io.on('connection', socket => {
    console.log('New user connected:', socket.id); // Log de connexion d'un nouvel utilisateur

    // Gestionnaire d'événements pour la déconnexion des utilisateurs
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id); // Log de déconnexion d'un utilisateur
        delete users[socket.id]; // Suppression de l'utilisateur de la liste des utilisateurs connectés
        io.emit('updateUsers', Object.values(users)); // Émission de l'événement pour mettre à jour la liste des utilisateurs connectés
    });

    // Gestionnaire d'événements pour la mise à jour de la position géographique d'un utilisateur
    socket.on('updateLocation', location => {
        users[socket.id] = { id: socket.id, ...location }; // Mise à jour de la position de l'utilisateur dans la liste des utilisateurs
        io.emit('updateUsers', Object.values(users)); // Émission de l'événement pour mettre à jour la liste des utilisateurs connectés
    });

    // Gestionnaire d'événements pour la demande de chat entre utilisateurs
    socket.on('requestChat', targetUserId => {
        io.to(targetUserId).emit('chatRequested', socket.id); // Émission de l'événement pour notifier le destinataire de la demande de chat
    });

    // Gestionnaire d'événements pour le clic sur un utilisateur
    socket.on('userClicked', targetUserId => {
        io.to(targetUserId).emit('showModal', socket.id); // Émission de l'événement pour afficher une modale chez le destinataire
    });

    // Gestionnaire d'événements pour l'acceptation d'un chat
    socket.on('acceptChat', (requesterId) => {
        // Créez une room unique pour l'appel
        const roomId = `room-${socket.id}-${requesterId}`;
        rooms.set(roomId, true);
        
        // Joindre les deux utilisateurs à la même room
        socket.join(roomId);
        io.to(requesterId).emit('chatAccepted', roomId); // Émission de l'événement pour notifier le demandeur que le chat est accepté
        io.to(socket.id).emit('chatAccepted', roomId); // Émission de l'événement pour notifier l'utilisateur actuel de l'acceptation du chat
        io.to(roomId).emit('showModal', roomId); // Émission de l'événement pour afficher une modale chez tous les utilisateurs
    });

    // Gestionnaire d'événements pour les signaux WebRTC
    socket.on('webrtcSignal', (data) => {
        console.log('Received WebRTC signal:', data); // Log de réception d'un signal WebRTC
        const { target, signal } = data;
        io.to(target).emit('webrtcSignal', { signal, from: socket.id }); // Émission du signal WebRTC vers le destinataire
    });

    // Gestion de l'événement 'hangupCall' côté serveur
    socket.on('hangupCall', () => {
        // Émettre l'événement à tous les clients, y compris l'émetteur initial
        io.emit('hangupCall');
    });
});

// Démarrage du serveur sur le port spécifié
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
