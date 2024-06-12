// Connexion au serveur Socket.IO
const socket = io();

// Gestion de l'acceptation du chat
socket.on('chatAccepted', (otherUserId) => {
    // Rejoindre une room avec l'autre utilisateur
    const roomId = `${socket.id}-${otherUserId}`;
    socket.emit('joinRoom', roomId);
    startCall(otherUserId);
});


// Fonction pour démarrer l'appel vidéo
const startCall = (roomId) => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "block";
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            document.getElementById('localVideo').srcObject = stream;
            const peerConnection = new RTCPeerConnection();
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

            // Gestion de la connexion ICE
            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('webrtcSignal', { target: roomId, signal: event.candidate });
                }
            };

            // Gestion du flux entrant
            peerConnection.ontrack = event => {
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            };

            // Gestion des signaux WebRTC
            socket.on('webrtcSignal', ({ signal, from }) => {
                if (from === roomId) {
                    if (signal.type === 'offer') {
                        peerConnection.createAnswer().then(answer => {
                            peerConnection.setLocalDescription(answer);
                            socket.emit('webrtcSignal', { target: roomId, signal: answer });
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
                peerConnection.setLocalDescription(offer);
                socket.emit('webrtcSignal', { target: roomId, signal: offer });
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

// Gestion de la fermeture de la modale de l'appel vidéo
const videoCallModal = document.getElementById("videoCallModal");
const videoCallModalCloseBtn = videoCallModal.querySelector('.close');
videoCallModalCloseBtn.onclick = function () {
    videoCallModal.style.display = "none";
};

// Gestion de la fermeture des modales en cliquant à l'extérieur
window.onclick = function (event) {
    if (event.target == videoCallModal) {
        videoCallModal.style.display = "none";
    }
};
