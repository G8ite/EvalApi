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

        marker.on('click', () => {
            if (id !== socket.id) {
                socket.emit('requestChat', id);
                socket.emit('userClicked', id);
            }
        });
    });
});

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

socket.on('chatAccepted', ({ room, userId }) => {
    socket.emit('joinRoom', room);
    startCall(room, userId);
});

const startCall = (room, otherUserId) => {
    const videoCallModal = document.getElementById("videoCallModal");
    videoCallModal.style.display = "block";
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            document.getElementById('localVideo').srcObject = stream;
            const peerConnection = new RTCPeerConnection();
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
