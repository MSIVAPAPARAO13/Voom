import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { AuthContext } from "./AuthContext";
import { apiClient } from "../services/apiClient";

export const OrganizationContext = createContext({});

export const OrganizationProvider = ({ children }) => {
    const { isAuthenticated, token } = useContext(AuthContext);
    const [organizations, setOrganizations] = useState([]);
    const [currentOrganization, setCurrentOrganization] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch user organizations whenever authentication is active
    const refreshOrganizations = useCallback(async () => {
        if (!isAuthenticated) return;

        setLoading(true);
        try {
            const res = await apiClient.get("/organizations");
            if (res.data?.success && res.data.organizations) {
                const orgs = res.data.organizations;
                setOrganizations(orgs);

                // Preserve current organization if valid; otherwise select the first one
                setCurrentOrganization((prev) => {
                    const match = orgs.find((o) => prev && o.id === prev.id);
                    const selected = match || orgs[0] || null;

                    if (selected) {
                        apiClient.defaults.headers.common["X-Organization-Id"] = selected.id;
                    } else {
                        delete apiClient.defaults.headers.common["X-Organization-Id"];
                    }
                    return selected;
                });
            }
        } catch (error) {
            console.error("Failed to load organizations:", error);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Load organizations when user logs in or token changes
    useEffect(() => {
        if (isAuthenticated && token) {
            refreshOrganizations();
        } else {
            // Clean up tenant context when logged out
            setOrganizations([]);
            setCurrentOrganization(null);
            delete apiClient.defaults.headers.common["X-Organization-Id"];
        }
    }, [isAuthenticated, token, refreshOrganizations]);

    // Switch active organization
    const switchOrganization = useCallback((orgId) => {
        const target = organizations.find((o) => o.id === orgId);
        if (target) {
            setCurrentOrganization(target);
            apiClient.defaults.headers.common["X-Organization-Id"] = target.id;
        }
    }, [organizations]);

    // Create a new organization
    const createOrganization = useCallback(async (name) => {
        try {
            const res = await apiClient.post("/organizations", { name });
            if (res.data?.success && res.data.organization) {
                await refreshOrganizations();
                const newOrgId = res.data.organization._id;
                switchOrganization(newOrgId);
                return res.data.organization;
            }
        } catch (error) {
            throw error;
        }
    }, [refreshOrganizations, switchOrganization]);

    const contextValue = useMemo(() => ({
        organizations,
        currentOrganization,
        loading,
        switchOrganization,
        createOrganization,
        refreshOrganizations
    }), [organizations, currentOrganization, loading, switchOrganization, createOrganization, refreshOrganizations]);

    return (
        <OrganizationContext.Provider value={contextValue}>
            {children}
        </OrganizationContext.Provider>
    );
};

export const useOrganization = () => useContext(OrganizationContext);
