import IRealtimeProvider from "./IRealtimeProvider";

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
};

export default class P2PRealtimeProvider extends IRealtimeProvider {
    constructor() {
        super();
        this.socket = null;
        this.localStream = null;
        this.socketId = null;
        this.connections = {};
        this.videos = []; // Array of { socketId, stream, autoplay, playsinline }
        
        // Bind methods
        this.gotMessageFromServer = this.gotMessageFromServer.bind(this);
        this.handleUserJoined = this.handleUserJoined.bind(this);
        this.handleUserLeft = this.handleUserLeft.bind(this);
    }

    async connect({ socket, socketId, localStream }) {
        this.socket = socket;
        this.socketId = socketId;
        this.localStream = localStream;

        // Register WebRTC signaling handlers on the existing socket
        this.socket.on('signal', this.gotMessageFromServer);
        this.socket.on('user-joined', this.handleUserJoined);
        this.socket.on('user-left', this.handleUserLeft);
    }

    disconnect() {
        if (this.socket) {
            this.socket.off('signal', this.gotMessageFromServer);
            this.socket.off('user-joined', this.handleUserJoined);
            this.socket.off('user-left', this.handleUserLeft);
        }
        
        // Close all peer connections
        for (let id in this.connections) {
            try {
                this.connections[id].close();
            } catch (e) { }
            delete this.connections[id];
        }
        this.videos = [];
        this._notifyParticipantsUpdated();
    }

    async replaceLocalStream(newStream) {
        this.localStream = newStream;
        // Replace track on all existing connections
        for (let id in this.connections) {
            try {
                const pc = this.connections[id];
                // P2P video meeting implementation originally used addStream, which is deprecated but works
                // A safer modern way is to replace tracks if senders exist
                const senders = pc.getSenders();
                const newTracks = newStream.getTracks();
                
                if (senders && senders.length > 0) {
                    newTracks.forEach(track => {
                        const sender = senders.find(s => s.track && s.track.kind === track.kind);
                        if (sender) {
                            sender.replaceTrack(track).catch(e => console.log(e));
                        }
                    });
                } else {
                    // Fallback to deprecated addStream for exact compatibility with existing codebase
                    pc.addStream(newStream);
                }
            } catch (e) { console.error(e); }
        }
    }

    // --- Private WebRTC Handlers ---

    gotMessageFromServer(fromId, message) {
        var signal = JSON.parse(message);

        if (fromId !== this.socketId) {
            if (signal.sdp) {
                this.connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        this.connections[fromId].createAnswer().then((description) => {
                            this.connections[fromId].setLocalDescription(description).then(() => {
                                this.socket.emit('signal', fromId, JSON.stringify({ 'sdp': this.connections[fromId].localDescription }));
                            }).catch(e => console.log(e));
                        }).catch(e => console.log(e));
                    }
                }).catch(e => console.log(e));
            }

            if (signal.ice) {
                this.connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }
    }

    handleUserJoined(id, clients) {
        clients.forEach((socketListId) => {
            if (this.connections[socketListId]) return;

            this.connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

            this.connections[socketListId].onicecandidate = (event) => {
                if (event.candidate != null) {
                    this.socket.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
                }
            };

            this.connections[socketListId].onaddstream = (event) => {
                let videoExists = this.videos.find(v => v.socketId === socketListId);

                if (videoExists) {
                    this.videos = this.videos.map(v =>
                        v.socketId === socketListId ? { ...v, stream: event.stream } : v
                    );
                } else {
                    let newVideo = {
                        socketId: socketListId,
                        stream: event.stream,
                        autoplay: true,
                        playsinline: true
                    };
                    this.videos = [...this.videos, newVideo];
                }
                this._notifyParticipantsUpdated();
            };

            if (this.localStream !== undefined && this.localStream !== null) {
                this.connections[socketListId].addStream(this.localStream);
            } else {
                let blackSilence = (...args) => new MediaStream([this._black(...args), this._silence()]);
                this.localStream = blackSilence();
                this.connections[socketListId].addStream(this.localStream);
            }
        });

        if (id === this.socketId) {
            for (let id2 in this.connections) {
                if (id2 === this.socketId) continue;

                try {
                    this.connections[id2].addStream(this.localStream);
                } catch (e) { }

                this.connections[id2].createOffer().then((description) => {
                    this.connections[id2].setLocalDescription(description)
                        .then(() => {
                            this.socket.emit('signal', id2, JSON.stringify({ 'sdp': this.connections[id2].localDescription }));
                        })
                        .catch(e => console.log(e));
                });
            }
        }
    }

    handleUserLeft(id) {
        this.videos = this.videos.filter((video) => video.socketId !== id);
        if (this.connections[id]) {
            this.connections[id].close();
            delete this.connections[id];
        }
        this._notifyParticipantsUpdated();
    }

    _notifyParticipantsUpdated() {
        if (this._onParticipantsUpdated) {
            this._onParticipantsUpdated(this.videos);
        }
    }

    _silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    _black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    };
}
