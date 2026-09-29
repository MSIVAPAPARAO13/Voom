import httpStatus from "http-status";
import mongoose from "mongoose";
import { Organization } from "../models/organization.model.js";
import { Membership } from "../models/membership.model.js";
import { User } from "../models/user.model.js";
import { entitlementService } from "../services/billing/entitlement.service.js";
import { ensureDefaultOrganization } from "../services/tenantMigration.service.js";

/**
 * Create a new organization.
 * Requester automatically becomes the 'owner' in Membership.
 */
export const createOrganization = async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Organization name is required."
        });
    }

    try {
        const cleanName = name.trim();
        const slugBase = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        const slugSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        const slug = `${slugBase || "org"}-${slugSuffix}`;

        const organization = await Organization.create({
            name: cleanName,
            slug,
            owner: req.user.id,
            status: "active"
        });

        const membership = await Membership.create({
            user: req.user.id,
            organization: organization._id,
            role: "owner",
            status: "active"
        });

        return res.status(httpStatus.CREATED).json({
            success: true,
            organization,
            membership
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to create organization: `
        });
    }
};

/**
 * List all organizations the authenticated user belongs to.
 * Auto-provisions a default workspace if the user has 0 memberships.
 */
export const getUserOrganizations = async (req, res) => {
    try {
        let memberships = await Membership.find({
            user: req.user.id,
            status: "active"
        })
            .populate("organization")
            .sort({ createdAt: 1 });

        // Auto-provision if user has no organizations yet (seamless Phase 1/2 user onboarding)
        if (memberships.length === 0) {
            const defaultOrg = await ensureDefaultOrganization(req.user);
            const defaultMembership = await Membership.findOne({
                user: req.user.id,
                organization: defaultOrg._id,
                status: "active"
            }).populate("organization");

            memberships = [defaultMembership];
        }

        const organizations = memberships
            .filter((m) => m.organization && m.organization.status === "active")
            .map((m) => ({
                id: m.organization._id,
                name: m.organization.name,
                slug: m.organization.slug,
                role: m.role,
                status: m.organization.status,
                joinedAt: m.joinedAt
            }));

        return res.status(httpStatus.OK).json({
            success: true,
            organizations
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to fetch organizations: `
        });
    }
};

/**
 * Get organization details (requires membership verified by verifyUrlOrgAccess).
 */
export const getOrganization = async (req, res) => {
    return res.status(httpStatus.OK).json({
        success: true,
        organization: req.organization,
        role: req.membership.role
    });
};

/**
 * Update organization details (requires owner or admin role).
 */
export const updateOrganization = async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Organization name is required."
        });
    }

    try {
        req.organization.name = name.trim();
        await req.organization.save();

        return res.status(httpStatus.OK).json({
            success: true,
            organization: req.organization
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to update organization: `
        });
    }
};

/**
 * List members in organization (requires active membership).
 */
export const listMembers = async (req, res) => {
    try {
        const memberships = await Membership.find({
            organization: req.organization._id,
            status: "active"
        })
            .populate("user", "name username")
            .sort({ role: 1, createdAt: 1 });

        const members = memberships
            .filter((m) => m.user)
            .map((m) => ({
                id: m.user._id,
                name: m.user.name,
                username: m.user.username,
                role: m.role,
                joinedAt: m.joinedAt
            }));

        return res.status(httpStatus.OK).json({
            success: true,
            members
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to list members: `
        });
    }
};

/**
 * Add an existing Voom user to organization.
 * Requires owner or admin role.
 */
export const addMember = async (req, res) => {
    const { username, role = "member" } = req.body;

    if (!username) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Username is required."
        });
    }

    if (!["admin", "member"].includes(role)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Role must be 'admin' or 'member'."
        });
    }

    try {
        const targetUser = await User.findOne({ username: username.trim() });
        if (!targetUser) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: "User not found."
            });
        }

        const entitlementCheck = await entitlementService.canUseFeature(req.organization._id, "members", "members", 1);
        if (!entitlementCheck.allowed) {
            return res.status(httpStatus.CONFLICT).json({
                success: false,
                message: "Member limit reached for the current plan.",
                code: "LIMIT_EXCEEDED"
            });
        }

        const existingMembership = await Membership.findOne({
            organization: req.organization._id,
            user: targetUser._id
        });

        if (existingMembership) {
            if (existingMembership.status === "active") {
                return res.status(httpStatus.CONFLICT).json({
                    success: false,
                    message: "User is already an active member of this organization."
                });
            }
            // Reactivate previously left member
            existingMembership.status = "active";
            existingMembership.role = role;
            existingMembership.joinedAt = new Date();
            await existingMembership.save();

            return res.status(httpStatus.OK).json({
                success: true,
                message: "Member reactivated successfully.",
                member: {
                    id: targetUser._id,
                    name: targetUser.name,
                    username: targetUser.username,
                    role: existingMembership.role
                }
            });
        }

        const newMembership = await Membership.create({
            user: targetUser._id,
            organization: req.organization._id,
            role,
            status: "active"
        });

        return res.status(httpStatus.CREATED).json({
            success: true,
            message: "Member added successfully.",
            member: {
                id: targetUser._id,
                name: targetUser.name,
                username: targetUser.username,
                role: newMembership.role
            }
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to add member: `
        });
    }
};

/**
 * Update member role.
 * Enforces OWNER PROTECTION rules:
 * - Admins cannot modify owner roles.
 * - Admins cannot promote anyone to owner.
 * - Sole owner cannot be demoted without transferring ownership.
 */
export const updateMemberRole = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !["owner", "admin", "member"].includes(role)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Valid role ('owner', 'admin', 'member') is required."
        });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Invalid user ID."
        });
    }

    try {
        const targetMembership = await Membership.findOne({
            organization: req.organization._id,
            user: userId,
            status: "active"
        });

        if (!targetMembership) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: "Member not found in this organization."
            });
        }

        // Rule 1: Admin cannot modify an owner
        if (targetMembership.role === "owner" && req.membership.role !== "owner") {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: "Admins cannot modify owner roles."
            });
        }

        // Rule 2: Only owners can assign the 'owner' role
        if (role === "owner" && req.membership.role !== "owner") {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: "Only the organization owner can promote members to owner."
            });
        }

        // Rule 3: Demoting an owner
        if (targetMembership.role === "owner" && role !== "owner") {
            const ownerCount = await Membership.countDocuments({
                organization: req.organization._id,
                role: "owner",
                status: "active"
            });

            if (ownerCount <= 1) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    success: false,
                    message: "Cannot demote the sole organization owner. Transfer ownership first."
                });
            }
        }

        // If transferring primary ownership, update organization.owner
        if (role === "owner") {
            req.organization.owner = userId;
            await req.organization.save();
        }

        targetMembership.role = role;
        await targetMembership.save();

        return res.status(httpStatus.OK).json({
            success: true,
            message: "Member role updated successfully.",
            member: {
                id: targetMembership.user,
                role: targetMembership.role
            }
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to update member role: `
        });
    }
};

/**
 * Remove member from organization.
 * Enforces OWNER PROTECTION:
 * - Owner cannot be removed.
 * - Admins cannot remove fellow admins (only owners can).
 */
export const removeMember = async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Invalid user ID."
        });
    }

    try {
        const targetMembership = await Membership.findOne({
            organization: req.organization._id,
            user: userId,
            status: "active"
        });

        if (!targetMembership) {
            return res.status(httpStatus.NOT_FOUND).json({
                success: false,
                message: "Member not found in this organization."
            });
        }

        // Owner protection: Owner cannot be removed
        if (targetMembership.role === "owner") {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: "The organization owner cannot be removed. Transfer ownership before leaving."
            });
        }

        // Admin protection: Admins cannot remove other admins (unless leaving self)
        if (
            targetMembership.role === "admin" &&
            req.membership.role !== "owner" &&
            userId !== req.user.id
        ) {
            return res.status(httpStatus.FORBIDDEN).json({
                success: false,
                message: "Only owners can remove administrators."
            });
        }

        // Soft removal: set status to 'suspended'
        targetMembership.status = "suspended";
        await targetMembership.save();

        return res.status(httpStatus.OK).json({
            success: true,
            message: "Member removed from organization."
        });
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: `Failed to remove member: `
        });
    }
};
