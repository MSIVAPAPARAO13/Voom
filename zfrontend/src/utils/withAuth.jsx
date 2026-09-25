import React, { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

const withAuth = (WrappedComponent) => {
    const AuthComponent = (props) => {
        const navigate = useNavigate();
        const { isAuthenticated, loading } = useContext(AuthContext);

        useEffect(() => {
            if (!loading && !isAuthenticated) {
                navigate("/auth");
            }
        }, [loading, isAuthenticated, navigate]);

        if (loading) {
            return null; // Prevents flashing during initial session verification
        }

        if (!isAuthenticated) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };

    return AuthComponent;
};

export default withAuth;
