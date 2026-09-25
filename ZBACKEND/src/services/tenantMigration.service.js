import { Organization } from "../models/organization.model.js";
import { Membership } from "../models/membership.model.js";
import { Meeting } from "../models/meeting.model.js";

/**
 * Ensures an existing or newly registered user has a default organization.
 * Idempotent: If user already has an active membership, returns the primary organization.
 * If 0 memberships exist, automatically provisions a personal workspace and associates existing meetings.
 */
export const ensureDefaultOrganization = async (user) => {
    // 1. Check for existing active membership
    const existingMembership = await Membership.findOne({
        user: user._id || user.id,
        status: "active"
    })
        .sort({ createdAt: 1 })
        .populate("organization");

    if (existingMembership && existingMembership.organization) {
        return existingMembership.organization;
    }

    // 2. Generate clean, unique slug
    const cleanUsername = (user.username || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const slugSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const slug = `${cleanUsername}-workspace-${slugSuffix}`;

    // 3. Create default organization
    const org = await Organization.create({
        name: `${user.name || user.username}'s Workspace`,
        slug,
        owner: user._id || user.id,
        status: "active"
    });

    // 4. Create owner membership
    await Membership.create({
        user: user._id || user.id,
        organization: org._id,
        role: "owner",
        status: "active"
    });

    // 5. Non-destructively associate any existing meetings created by this user in Phase 1/2
    if (user.username) {
        await Meeting.updateMany(
            {
                user_id: user.username,
                organization: { $exists: false }
            },
            {
                $set: {
                    organization: org._id,
                    createdBy: user._id || user.id
                }
            }
        );
    }

    return org;
};
