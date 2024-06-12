const socket = io();
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

const Bleu = '#0000FF';
const Rouge = '#FF0000';

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

let markers = {};
let localStream;
let peerConnections = {};

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

socket.on('updateUsers', users => {
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    users.forEach(user => {
        const { id, lat, lon } = user;
        const markerIcon = id === socket.id ? redIcon : blueIcon;
        const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
        markers[id] = marker;

        marker.on('click', () => {
            if (id !== socket.id) {
                socket.emit('requestChat', id);
            }
        });
    });
});

socket.on('chatRequested', requesterId => {
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

socket.on('chatAccepted', ({ room, userId }) => {
    socket.emit('joinRoom', room);
    startCall(room, userId);
});

const startCall = (room, otherUserId) => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "block";

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            console.log('Local stream obtained');
            document.getElementById('localVideo').srcObject = stream;
            localStream = stream;

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

            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
                console.log(`Track added: ${track.kind}`);
            });

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    console.log('Sending ICE candidate');
                    socket.emit('webrtcSignal', { target: otherUserId, signal: event.candidate });
                }
            };

            peerConnection.ontrack = event => {
                console.log('Remote stream received');
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            };

            peerConnection.oniceconnectionstatechange = () => {
                console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
                if (peerConnection.iceConnectionState === 'disconnected') {
                    videoCallModal.style.display = "none";
                }
            };

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

            if (otherUserId) {
                peerConnection.createOffer().then(offer => {
                    peerConnection.setLocalDescription(offer);
                    console.log('Sending SDP offer');
                    socket.emit('webrtcSignal', { target: otherUserId, signal: offer });
                });
            }

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

const modal = document.getElementById("modal");
const modalCloseBtn = modal.querySelector('.close');
modalCloseBtn.onclick = function () {
    modal.style.display = "none";
};

const videoCallModal = document.getElementById("videoCallModal");
const videoCallModalCloseBtn = videoCallModal.querySelector('.close');
videoCallModalCloseBtn.onclick = function () {
    videoCallModal.style.display = "none";
};

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    } else if (event.target == videoCallModal) {
        videoCallModal.style.display = "none";
    }
};

socket.on('hangupCall', () => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "none";
});
