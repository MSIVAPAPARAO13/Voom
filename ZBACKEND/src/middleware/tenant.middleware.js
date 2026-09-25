import mongoose from "mongoose";
import httpStatus from "http-status";
import { Membership } from "../models/membership.model.js";
import { Organization } from "../models/organization.model.js";
import { ensureDefaultOrganization } from "../services/tenantMigration.service.js";

/**
 * Tenant Resolution Middleware:
 * Resolves canonical active tenant via `X-Organization-Id` header.
 * NEVER trusts the header blindly: verifies that req.user holds an active Membership.
 * If X-Organization-Id is absent, deterministically falls back to user's primary/default organization.
 */
export const resolveTenant = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(httpStatus.UNAUTHORIZED).json({
            success: false,
            message: "Authentication required before resolving organization context."
        });
    }

    const orgHeader = req.headers["x-organization-id"] || (req.query && req.query.orgId);

    try {
        if (!orgHeader) {
            // Deterministic default organization fallback
            const defaultOrg = await ensureDefaultOrganization(req.user);
            const membership = await Membership.findOne({
                user: req.user.id,
                organization: defaultOrg._id,
                status: "active"
            });

            req.organization = defaultOrg;
            req.membership = membership;
            return next();
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(orgHeader)) {
            return res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: "Invalid X-Organization-Id format."
            });
        }

        // Verify active membership in the specified organization
        const membership = await Membership.findOne({
            user: req.user.id,
            organization: orgHeader,
            status: "active"
        }).populate("organization");

        if (!membership || !membership.organization || membership.organization.status !== "active") {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: "Access denied. You are not an active member of this organization."
            });
        }

        req.organization = membership.organization;
        req.membership = membership;
        return next();
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Tenant resolution error"
        });
    }
};

/**
 * URL-Scoped Organization Authorization Middleware:
 * For routes like /organizations/:organizationId.
 * Verifies that req.user has an active membership for the specific :organizationId in the URL.
 */
export const verifyUrlOrgAccess = async (req, res, next) => {
    const orgId = req.params.organizationId || req.params.id;

    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Invalid organization ID in URL."
        });
    }

    try {
        const membership = await Membership.findOne({
            user: req.user.id,
            organization: orgId,
            status: "active"
        }).populate("organization");

        if (!membership || !membership.organization || membership.organization.status !== "active") {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: "Access denied. You are not a member of the requested organization."
            });
        }

        req.organization = membership.organization;
        req.membership = membership;
        return next();
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Organization access error"
        });
    }
};

/**
 * Role-Based Authorization Middleware for Organizations:
 * Verifies that req.membership.role matches one of the allowed roles.
 */
export const requireOrgRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.membership || !allowedRoles.includes(req.membership.role)) {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: `Insufficient organization permissions. Required role: [${allowedRoles.join(", ")}]. Current role: '${req.membership?.role || "none"}'`
            });
        }
        return next();
    };
};
