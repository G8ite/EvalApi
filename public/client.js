// Connexion au serveur Socket.IO
const socket = io();
// Création de la carte Leaflet
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Définition des couleurs des marqueurs
const Bleu = '#0000FF';
const Rouge = '#FF0000';

// Styles CSS pour les marqueurs
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

// Création des icônes des marqueurs
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

// Objets pour stocker les marqueurs des utilisateurs
let markers = {};

// Obtention de la position actuelle de l'utilisateur
navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude } = position.coords;
    const location = { lat: latitude, lon: longitude };
    const marker = L.marker([latitude, longitude], { icon: redIcon }).addTo(map);
    markers[socket.id] = marker;
    socket.emit('updateLocation', location);

    // Zoom sur la position de l'utilisateur local
    map.setView([latitude, longitude], 10);
}, error => {
    console.error('Error getting location:', error);
});

// Événement de mise à jour des utilisateurs
socket.on('updateUsers', users => {
    console.log("Received updated users:", users);
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    users.forEach(user => {
        const { id, lat, lon } = user;
        console.log("User id:", id);
        console.log("Socket id:", socket.id);
        const markerIcon = id === socket.id ? redIcon : blueIcon;
        const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
        markers[id] = marker;

        // Gestion de l'événement de clic sur un marqueur
        marker.on('click', () => {
            if (id !== socket.id) {
                // Émission d'une demande de chat au serveur
                socket.emit('requestChat', id);

                // Émission d'un événement au serveur pour notifier l'utilisateur cliqué
                socket.emit('userClicked', id);
            }
        });
    });
});
socket.on("hangupCall", () => {
    videoCallModal.style.display = "none";
})
// Gestion de l'affichage de la modale
socket.on('showModal', (otherUserId) => {
    if (otherUserId.includes(socket.id)) {
        const modal = document.getElementById("modal");
        modal.style.display = "block";
        const acceptBtn = document.getElementById('acceptBtn');
        const declineBtn = document.getElementById('declineBtn');

        acceptBtn.onclick = function () {
            modal.style.display = "none";
            socket.emit('acceptChat', otherUserId);
            startCall(otherUserId);
        };

        declineBtn.onclick = function () {
            modal.style.display = "none";
        };
    }
});

// Gestion de la demande de chat
socket.on('chatRequested', (requesterId) => {
    const modal = document.getElementById("modal");
    modal.style.display = "block";
    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');

    acceptBtn.onclick = function () {
        modal.style.display = "none";
        socket.emit('acceptChat', requesterId);
        startCall(requesterId);
    };

    declineBtn.onclick = function () {
        modal.style.display = "none";
    };
});

// Gestion de l'acceptation du chat
socket.on('chatAccepted', (otherUserId) => {
    startCall(otherUserId);
});

// Fonction pour démarrer l'appel vidéo
const startCall = (otherUserId) => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "block";
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            console.log(stream)
            document.getElementById('localVideo').srcObject = stream;
            const peerConnection = new RTCPeerConnection();
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

            // Gestion de la connexion ICE
            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('webrtcSignal', { target: otherUserId, signal: event.candidate });
                }
            };

            // Gestion du flux entrant
            peerConnection.ontrack = event => {
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            };

            // Gestion des signaux WebRTC
            socket.on('webrtcSignal', ({ signal, from }) => {
                console.log(from)
                if (from === otherUserId) {
                    if (signal.type === 'offer') {
                        console.log(peerConnection)
                        // peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
                        peerConnection.createAnswer().then(answer => {
                            console.log(answer)
                            peerConnection.setLocalDescription(answer);
                            socket.emit('webrtcSignal', { target: otherUserId, signal: answer });
                        });
                    } else if (signal.type === 'answer') {
                        peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
                    } else if (signal.candidate) {
                        peerConnection.addIceCandidate(new RTCIceCandidate(signal));
                    }
                }
            });

            // Création et envoi de l'offre
            peerConnection.createOffer().then(offer => {
                console.log(offer)
                peerConnection.setLocalDescription(offer);
                socket.emit('webrtcSignal', { target: otherUserId, signal: offer });
            });

            // Gestion du bouton de raccrochage
            document.getElementById('hangupBtn').onclick = () => {
                peerConnection.close();
                videoCallModal.style.display = "none";
                socket.emit('hangupCall');
            };
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });
};

// Gestion de la fermeture de la modale de confirmation
const modal = document.getElementById("modal");
const modalCloseBtn = modal.querySelector('.close');
modalCloseBtn.onclick = function () {
    modal.style.display = "none";
};

// Gestion de la fermeture de la modale de l'appel vidéo
const videoCallModal = document.getElementById("videoCallModal");
const videoCallModalCloseBtn = videoCallModal.querySelector('.close');
videoCallModalCloseBtn.onclick = function () {
    videoCallModal.style.display = "none";
};

// Gestion de la fermeture des modales en cliquant à l'extérieur
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
    if (event.target == videoCallModal) {
        videoCallModal.style.display = "none";
    }
};