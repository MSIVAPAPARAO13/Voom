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
