import httpStatus from "http-status";
import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../services/apiClient";

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    // In-memory access token storage (never stored in localStorage)
    const [token, setToken] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const tokenRef = useRef(null);
    const router = useNavigate();

    // Keep tokenRef synchronized with in-memory token state
    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    // Axios request interceptor: attach short-lived Bearer access token
    useEffect(() => {
        const reqInterceptor = apiClient.interceptors.request.use(
            (config) => {
                if (tokenRef.current) {
                    config.headers.Authorization = `Bearer ${tokenRef.current}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Axios response interceptor: auto-refresh on 401 with single-retry guard
        const resInterceptor = apiClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (
                    error.response?.status === 401 &&
                    !originalRequest._retry &&
                    !originalRequest.url?.includes("/refresh") &&
                    !originalRequest.url?.includes("/login")
                ) {
                    originalRequest._retry = true;

                    try {
                        const res = await apiClient.post("/users/refresh");
                        if (res.data?.accessToken) {
                            setToken(res.data.accessToken);
                            tokenRef.current = res.data.accessToken;
                            setUserData(res.data.user);
                            originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
                            return apiClient(originalRequest);
                        }
                    } catch (refreshErr) {
                        setToken(null);
                        tokenRef.current = null;
                        setUserData(null);
                        return Promise.reject(refreshErr);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            apiClient.interceptors.request.eject(reqInterceptor);
            apiClient.interceptors.response.eject(resInterceptor);
        };
    }, []);

    // Restore authentication on initial load / refresh via HttpOnly cookie
    useEffect(() => {
        const initAuth = async () => {
            try {
                const res = await apiClient.post("/users/refresh");
                if (res.data?.accessToken) {
                    setToken(res.data.accessToken);
                    tokenRef.current = res.data.accessToken;
                    setUserData(res.data.user);
                }
            } catch (err) {
                setToken(null);
                tokenRef.current = null;
                setUserData(null);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const handleRegister = useCallback(async (name, username, password) => {
        try {
            const request = await apiClient.post("/users/register", {
                name,
                username,
                password
            });

            if (request.status === httpStatus.CREATED) {
                return request.data.message;
            }
        } catch (err) {
            throw err;
        }
    }, []);

    const handleLogin = useCallback(async (username, password) => {
        try {
            const request = await apiClient.post("/users/login", {
                username,
                password
            });

            if (request.status === httpStatus.OK) {
                setToken(request.data.accessToken);
                tokenRef.current = request.data.accessToken;
                setUserData(request.data.user);
                router("/home");
                return request.data;
            }
        } catch (err) {
            throw err;
        }
    }, [router]);

    const handleLogout = useCallback(async () => {
        try {
            await apiClient.post("/users/logout");
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            setToken(null);
            tokenRef.current = null;
            setUserData(null);
            router("/auth");
        }
    }, [router]);

    const getHistoryOfUser = useCallback(async () => {
        try {
            const request = await apiClient.get("/users/get_all_activity");
            return request.data;
        } catch (err) {
            throw err;
        }
    }, []);

    const addToUserHistory = useCallback(async (meetingCode) => {
        try {
            const request = await apiClient.post("/users/add_to_activity", {
                meeting_code: meetingCode
            });
            return request.data;
        } catch (err) {
            throw err;
        }
    }, []);

    const contextValue = useMemo(() => ({
        token,
        userData,
        loading,
        isAuthenticated: !!token,
        handleRegister,
        handleLogin,
        handleLogout,
        getHistoryOfUser,
        addToUserHistory
    }), [token, userData, loading, handleRegister, handleLogin, handleLogout, getHistoryOfUser, addToUserHistory]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
