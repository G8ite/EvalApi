// Connexion au serveur WebSocket
const socket = io();

// Initialisation de la carte Leaflet
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Définition des couleurs pour les marqueurs
const Bleu = '#0000FF';
const Rouge = '#FF0000';

// Styles CSS pour les marqueurs bleus et rouges
const markerHtmlStylesBleu = `
    background-color: ${Bleu};
    width: 3rem;
    height: 3rem;
    display: block;
    left: -1.5rem;
    top: -1.5rem;
    position: relative;
    border-radius: 3rem 3rem 0;
    transform: rotate(45deg);
    border: 1px solid #FFFFFF`;

const markerHtmlStylesRouge = `
    background-color: ${Rouge};
    width: 3rem;
    height: 3rem;
    display: block;
    left: -1.5rem;
    top: -1.5rem;
    position: relative;
    border-radius: 3rem 3rem 0;
    transform: rotate(45deg);
    border: 1px solid #FFFFFF`;

// Création des icônes personnalisées pour les marqueurs bleus et rouges
const blueIcon = L.divIcon({
    className: "my-custom-pin",
    iconAnchor: [0, 24],
    labelAnchor: [-6, 0],
    popupAnchor: [0, -36],
    html: `<span style="${markerHtmlStylesBleu}" />`
});

const redIcon = L.divIcon({
    className: "my-custom-pin",
    iconAnchor: [0, 24],
    labelAnchor: [-6, 0],
    popupAnchor: [0, -36],
    html: `<span style="${markerHtmlStylesRouge}" />`
});

// Initialisation des variables pour les marqueurs et les flux vidéo
let markers = {};
let localStream;
let remoteStream;
let peerConnections = {};

// Obtention de la position actuelle de l'utilisateur
navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude } = position.coords;
    const location = { lat: latitude, lon: longitude };
    const marker = L.marker([latitude, longitude], { icon: redIcon }).addTo(map);
    markers[socket.id] = marker;
    socket.emit('updateLocation', location);

    map.setView([latitude, longitude], 10);
}, error => {
    console.error('Error getting location:', error);
});

// Gestionnaire d'événement pour la mise à jour des utilisateurs sur la carte
socket.on('updateUsers', users => {
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    users.forEach(user => {
        const { id, lat, lon } = user;
        const markerIcon = id === socket.id ? redIcon : blueIcon;
        const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
        markers[id] = marker;

        // Gestionnaire d'événement pour les clics sur les marqueurs
        marker.on('click', () => {
            if (id !== socket.id) {
                socket.emit('requestChat', id);
            }
        });
    });
});

// Gestionnaire d'événement pour la demande de chat
socket.on('chatRequested', requesterId => {
    const modal = document.getElementById("modal");
    modal.style.display = "block";

    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');

    // Gestionnaire d'événement pour accepter le chat
    acceptBtn.onclick = function () {
        modal.style.display = "none";
        socket.emit('acceptChat', requesterId);
        startCall(requesterId);
    };

    // Gestionnaire d'événement pour refuser le chat
    declineBtn.onclick = function () {
        modal.style.display = "none";
    };
});

// Gestionnaire d'événement pour l'acceptation du chat
socket.on('chatAccepted', ({ room, userId }) => {
    socket.emit('joinRoom', room);
    startCall(room, userId);
});

// Fonction pour démarrer un appel vidéo
const startCall = (room, otherUserId) => {
    // Affichage du modal de l'appel vidéo
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "block";

    // Obtention de l'accès aux périphériques multimédias
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            console.log('Local stream obtained');
            console.log(stream)
            document.getElementById('localVideo').srcObject = stream;
            localStream = stream;

            // Création de la connexion peer-to-peer
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            });
            peerConnections[room] = peerConnection;

            // Ajout des pistes du flux local à la connexion peer-to-peer
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
                console.log(`Track added: ${track.kind}`);
            });

            // Gestionnaire d'événement pour la génération de candidats ICE
            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    console.log('Sending ICE candidate');
                    socket.emit('webrtcSignal', { target: otherUserId, signal: event.candidate });
                }
            };

            // Gestionnaire d'événement pour la réception des flux distants
            peerConnection.ontrack = event => {
                console.log('Remote stream received');
                console.log(event.streams[0])
                document.getElementById('remoteVideo').srcObject = event.streams[0];
                remoteStream = event.streams[0]
            };

            // Gestionnaire d'événement pour le changement de l'état de la connexion ICE
            peerConnection.oniceconnectionstatechange = () => {
                console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
                if (peerConnection.iceConnectionState === 'disconnected') {
                    videoCallModal.style.display = "none";
                }
            };

            // Gestionnaire d'événement pour la réception des signaux WebRTC
            socket.on('webrtcSignal', ({ signal, from }) => {
                if (from === otherUserId) {
                    if (signal.type === 'offer') {
                        console.log('Received SDP offer');
                        peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
                        peerConnection.createAnswer().then(answer => {
                            peerConnection.setLocalDescription(answer);
                            console.log('Sending SDP answer');
                            socket.emit('webrtcSignal', { target: otherUserId, signal: answer });
                        });
                    } else if (signal.type === 'answer') {
                        console.log('Received SDP answer');
                        peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
                    } else if (signal.candidate) {
                        console.log('Received ICE candidate');
                        peerConnection.addIceCandidate(new RTCIceCandidate(signal));
                    }
                }
            });

            // Envoi de l'offre SDP au pair distant
            if (otherUserId) {
                peerConnection.createOffer().then(offer => {
                    peerConnection.setLocalDescription(offer);
                    console.log('Sending SDP offer');
                    socket.emit('webrtcSignal', { target: otherUserId, signal: offer });
                });
            }

            // Gestionnaire d'événement pour terminer l'appel
            document.getElementById('hangupBtn').onclick = () => {
                peerConnection.close();
                videoCallModal.style.display = "none";
                socket.emit('hangupCall', room);
            };
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });
};

// Gestionnaire d'événement pour fermer la modale de demande de chat
const modal = document.getElementById("modal");
const modalCloseBtn = modal.querySelector('.close');
modalCloseBtn.onclick = function () {
    modal.style.display = "none";
};

// Gestionnaire d'événement pour fermer la modale de l'appel vidéo
const videoCallModal = document.getElementById("videoCallModal");
const videoCallModalCloseBtn = videoCallModal.querySelector('.close');
videoCallModalCloseBtn.onclick = function () {
    videoCallModal.style.display = "none";
};

// Gestionnaire d'événement pour fermer les modales en cliquant en dehors d'elles
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    } else if (event.target == videoCallModal) {
        videoCallModal.style.display = "none";
    }
};

// Gestionnaire d'événement pour terminer l'appel lorsque l'autre partie raccroche
socket.on('hangupCall', () => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "none";
});
