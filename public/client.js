// Connexion au serveur Socket.IO
const socket = io();

// Fonction pour démarrer l'appel vidéo
let peerConnection;

const startCall = (otherUserId) => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "block";

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            document.getElementById('localVideo').srcObject = stream;
            peerConnection = new RTCPeerConnection();

            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('webrtcSignal', { target: otherUserId, signal: event.candidate });
                }
            };

            peerConnection.ontrack = event => {
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            };

            socket.on('webrtcSignal', ({ signal, from }) => {
                if (from === otherUserId) {
                    if (signal.type === 'offer') {
                        peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
                        peerConnection.createAnswer().then(answer => {
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

            peerConnection.createOffer().then(offer => {
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

// Gestion de la fin de l'appel
socket.on("hangupCall", () => {
    if (peerConnection) {
        peerConnection.close();
    }
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "none";
});

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
