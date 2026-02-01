# 🎥 Voom — Peer-to-Peer Video Conferencing App (WebRTC + MERN + Socket.IO)

Voom is a full-fledged peer-to-peer video conferencing web application inspired by platforms like Google Meet and Zoom.
Built from scratch using WebRTC, Socket.IO, and the MERN stack, it enables seamless real-time communication between users with a clean UI and secure authentication.

## 🚀 Why I Built This

During online classes, my friends and I constantly used Zoom and Google Meet.
I always wondered:

How does my video appear instantly on someone else’s screen?

Where’s the backend magic?

Is this WebRTC sorcery? Node.js wizardry? Or Elon? 😅

Curiosity turned into obsession — and instead of just joining meetings, I decided to build my own video conferencing app.
That’s how Voom was born.

## ✨ Features
🎥 One-Click Video Calls

Real-time audio/video streaming using WebRTC

Peer-to-peer communication for low latency

🔐 Secure Authentication

JWT-based login

Protected routes

User sessions handled safely

👥 Meeting History

Track previous meetings

Know who you talked to & when

Stored securely in MongoDB

🖥️ Screen Sharing

Share your entire screen or a specific tab

Great for demos, study sessions, or debugging

💬 Real-Time Chat

Instant messaging inside the call

Uses WebRTC data channels + Socket.IO

🧼 Clean & Responsive UI

Built with Material UI

Works on all screen sizes

## 🛠️ Tech Stack
Frontend

React.js

Material UI

React Router DOM

WebRTC

Backend

Node.js

Express.js

Socket.IO (Signaling server)

JWT Authentication

MongoDB + Mongoose

Real-Time Communication

WebRTC (Peer-to-peer video/audio)

STUN servers

ICE Candidates

Socket.IO (for signaling)

## 🏗️ Architecture Overview
React (UI)  --->  Socket.IO Server (Signaling)  --->  WebRTC Peer Connection
                                |
                           MongoDB (Auth + History)
## 📂 Project Structure
Voom/
│── client/               # React frontend
│── server/               # Node.js + Express backend
│── package.json
│── README.md
└── ...
## ▶️ Run Locally
Clone the repository
git clone https://github.com/MSIVAPAPARAO13/Voom
cd Voom
Install dependencies

Client

cd client
npm install
npm start


Server

cd server
npm install
npm start

## 🚧 Current Status

Running on localhost for development

Deployment planned (Render / AWS / Netlify)

Fixing some ICE candidate quirks 😅

Adding multi-participant support soon

## 📌 Roadmap

 Group video calls

 Call recording

 Typing indicators in chat

 Email-based invitations

 Full cloud deployment

## 🤝 Contributing

PRs are welcome!
If you’re interested in WebRTC, real-time systems, or peer-to-peer technology — let’s collaborate.

## 🧑‍💻 Author

Siva Paparao Medisetti

## ⭐ Show Your Support

If you found this project interesting, please star 🌟 the repo — it motivates me to work on more WebRTC experiments!
