const server = process.env.REACT_APP_SERVER_URL || process.env.REACT_APP_SOCKET_URL || (
    typeof window !== "undefined" && window.location.hostname.endsWith(".onrender.com")
        ? "https://voom-api.onrender.com"
        : "http://localhost:8000"
);

export default server;

