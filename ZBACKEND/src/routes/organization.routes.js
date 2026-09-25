import { Router } from "express";
import {
    createOrganization,
    getUserOrganizations,
    getOrganization,
    updateOrganization,
    listMembers,
    addMember,
    updateMemberRole,
    removeMember
} from "../controllers/organization.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { verifyUrlOrgAccess, requireOrgRole } from "../middleware/tenant.middleware.js";
import { askOrganizationKnowledge } from "../controllers/askVoom.controller.js";

const router = Router();

// All organization routes require authenticated user identity
router.use(authenticate);

// Organization Management: Create & List
router.route("/").post(createOrganization);
router.route("/").get(getUserOrganizations);

// Organization Details & Updates
router.route("/:id").get(verifyUrlOrgAccess, getOrganization);
router.route("/:id").patch(verifyUrlOrgAccess, requireOrgRole(["owner", "admin"]), updateOrganization);

// Organization Members
router.route("/:id/members").get(verifyUrlOrgAccess, listMembers);
router.route("/:id/members").post(verifyUrlOrgAccess, requireOrgRole(["owner", "admin"]), addMember);
router.route("/:id/members/:userId").patch(verifyUrlOrgAccess, requireOrgRole(["owner", "admin"]), updateMemberRole);
router.route("/:id/members/:userId").delete(verifyUrlOrgAccess, requireOrgRole(["owner", "admin"]), removeMember);

// Ask Voom (RAG)
router.route("/:id/ask").post(verifyUrlOrgAccess, requireOrgRole(["owner", "admin", "member"]), askOrganizationKnowledge);

export default router;
