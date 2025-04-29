const socket = io();
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const leaveBtn = document.getElementById('leaveBtn');
const videoContainer = document.getElementById('video-container');
const statusDiv = document.getElementById('status');

let localStream;
let peerConnections = {};
let currentRoom = null;

// Initially hide video controls
muteBtn.style.display = 'none';
cameraBtn.style.display = 'none';
leaveBtn.style.display = 'none';

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

createBtn.onclick = async () => {
    const roomId = generateRoomId();
    roomInput.value = roomId;
    await joinRoom(roomId);
};

joinBtn.onclick = async () => {
    const roomId = roomInput.value;
    if (!roomId) {
        updateStatus('Please enter a room ID', 'error');
        return;
    }
    await joinRoom(roomId);
};

async function joinRoom(roomId) {
    try {
        updateStatus('Joining room...', 'info');
        
        // Get user media first
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });

        // Create and add local video
        const localVideo = document.createElement('video');
        localVideo.srcObject = localStream;
        localVideo.autoplay = true;
        localVideo.playsInline = true;
        localVideo.classList.add('local-video');
        videoContainer.innerHTML = ''; // Clear previous videos
        videoContainer.appendChild(localVideo);

        // Join the room
        socket.emit('join-room', roomId);
        currentRoom = roomId;
        
        // Show video controls
        muteBtn.style.display = 'inline-block';
        cameraBtn.style.display = 'inline-block';
        leaveBtn.style.display = 'inline-block';
        createBtn.style.display = 'none';
        joinBtn.style.display = 'none';
        roomInput.style.display = 'none';

        updateStatus(`Connected to room: ${roomId}`, 'success');

    } catch (error) {
        console.error('Error:', error);
        updateStatus('Failed to access camera/microphone. Please check permissions.', 'error');
    }
}

socket.on('user-joined', async (userId) => {
    updateStatus('New user joined the room!', 'info');
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnections[userId] = peerConnection;

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('signal', { to: userId, data: { candidate: event.candidate } });
        }
    };

    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { to: userId, data: { sdp: offer } });
    } catch (error) {
        console.error('Error creating offer:', error);
        updateStatus('Failed to establish connection', 'error');
    }
});

socket.on('signal', async ({ from, data }) => {
    try {
        if (!peerConnections[from]) {
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            peerConnections[from] = peerConnection;

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('signal', { to: from, data: { candidate: event.candidate } });
                }
            };

            peerConnection.ontrack = event => {
                const remoteVideo = document.createElement('video');
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.classList.add('remote-video');
                videoContainer.appendChild(remoteVideo);
                updateStatus('Connected with peer!', 'success');
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit('signal', { to: from, data: { sdp: answer } });
        } else if (data.candidate) {
            await peerConnections[from].addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (error) {
        console.error('Error handling signal:', error);
        updateStatus('Failed to establish peer connection', 'error');
    }
});

muteBtn.onclick = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    muteBtn.textContent = audioTrack.enabled ? 'Mute' : 'Unmute';
};

cameraBtn.onclick = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    cameraBtn.textContent = videoTrack.enabled ? 'Turn Off Camera' : 'Turn On Camera';
};

leaveBtn.onclick = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    videoContainer.innerHTML = '';
    socket.disconnect();
    
    // Reset UI
    muteBtn.style.display = 'none';
    cameraBtn.style.display = 'none';
    leaveBtn.style.display = 'none';
    createBtn.style.display = 'inline-block';
    joinBtn.style.display = 'inline-block';
    roomInput.style.display = 'inline-block';
    roomInput.value = '';
    currentRoom = null;
    updateStatus('Left the room', 'info');
    
    // Reconnect socket
    socket.connect();
};
