import axios from "axios";
import server from "../environment";

/**
 * Centralized Axios client for all Voom API communication.
 * - Base URL: http://localhost:8000/api/v1
 * - withCredentials: true (sends HttpOnly refresh token cookies)
 * - Headers: Authorization (Bearer access token) & X-Organization-Id (canonical tenant scope)
 */
export const apiClient = axios.create({
    baseURL: `${server}/api/v1`,
    withCredentials: true
});

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Safe logging for observability
        if (error.response) {
            const requestId = error.response.headers['x-request-id'] || 'unknown';
            console.error(`[API Error] ${error.config.method.toUpperCase()} ${error.config.url} - Status: ${error.response.status} - RequestId: ${requestId}`);
        } else {
            console.error(`[API Network Error] ${error.config.method.toUpperCase()} ${error.config.url} - ${error.message}`);
        }
        return Promise.reject(error);
    }
);
