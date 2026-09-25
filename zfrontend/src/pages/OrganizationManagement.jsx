import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Container,
    Typography,
    Paper,
    Box,
    Button,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Select,
    MenuItem,
    Chip,
    Alert,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { OrganizationContext } from "../contexts/OrganizationContext";
import { apiClient } from "../services/apiClient";
import withAuth from "../utils/withAuth";

function OrganizationManagement() {
    const navigate = useNavigate();
    const { currentOrganization, refreshOrganizations } = useContext(OrganizationContext);

    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Add Member Dialog
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newRole, setNewRole] = useState("member");

    // Edit Organization Name
    const [orgName, setOrgName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);

    // Billing
    const [plan, setPlan] = useState(null);
    const [entitlements, setEntitlements] = useState(null);
    const [usage, setUsage] = useState(null);

    const fetchMembers = useCallback(async () => {
        if (!currentOrganization) return;
        setLoading(true);
        setError("");
        try {
            const res = await apiClient.get(`/organizations/${currentOrganization.id}/members`);
            if (res.data?.success) {
                setMembers(res.data.members);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load members.");
        } finally {
            setLoading(false);
        }
    }, [currentOrganization]);

    const fetchBilling = useCallback(async () => {
        if (!currentOrganization) return;
        try {
            const [planRes, usageRes] = await Promise.all([
                apiClient.get(`/billing/plan`, { headers: { "X-Organization-Id": currentOrganization.id } }),
                apiClient.get(`/billing/usage`, { headers: { "X-Organization-Id": currentOrganization.id } })
            ]);
            setPlan(planRes.data.plan);
            setEntitlements(planRes.data.entitlements);
            setUsage(usageRes.data.usage);
        } catch (err) {
            console.error("Failed to load billing", err);
        }
    }, [currentOrganization]);

    useEffect(() => {
        if (currentOrganization) {
            setOrgName(currentOrganization.name);
            fetchMembers();
            fetchBilling();
        }
    }, [currentOrganization, fetchMembers, fetchBilling]);

    const handleSaveName = async () => {
        if (!orgName.trim() || !currentOrganization) return;
        setError("");
        setSuccess("");
        try {
            await apiClient.patch(`/organizations/${currentOrganization.id}`, { name: orgName.trim() });
            setSuccess("Organization name updated successfully.");
            setIsEditingName(false);
            refreshOrganizations();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update organization name.");
        }
    };

    const handleAddMember = async () => {
        if (!newUsername.trim() || !currentOrganization) return;
        setError("");
        setSuccess("");
        try {
            await apiClient.post(`/organizations/${currentOrganization.id}/members`, {
                username: newUsername.trim(),
                role: newRole
            });
            setSuccess(`User '${newUsername}' added successfully.`);
            setOpenAddDialog(false);
            setNewUsername("");
            setNewRole("member");
            fetchMembers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add member.");
        }
    };

    const handleRoleChange = async (userId, role) => {
        if (!currentOrganization) return;
        setError("");
        setSuccess("");
        try {
            await apiClient.patch(`/organizations/${currentOrganization.id}/members/${userId}`, { role });
            setSuccess("Member role updated successfully.");
            fetchMembers();
            refreshOrganizations();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update member role.");
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!currentOrganization) return;
        setError("");
        setSuccess("");
        try {
            await apiClient.delete(`/organizations/${currentOrganization.id}/members/${userId}`);
            setSuccess("Member removed successfully.");
            fetchMembers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to remove member.");
        }
    };

    const isOwnerOrAdmin = currentOrganization?.role === "owner" || currentOrganization?.role === "admin";
    const isOwner = currentOrganization?.role === "owner";

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa", pt: 4, pb: 8 }}>
            <Container maxWidth="md">
                <Box sx={{ display: "flex", alignItems: "center", mb: 4, bgcolor: "white", p: 3, borderRadius: 2, boxShadow: 1 }}>
                    <IconButton onClick={() => navigate("/home")} sx={{ mr: 2, color: "#FF9839" }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: "800", color: "#2c3e50" }}>
                            Organization Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage your workspace, members, and billing
                        </Typography>
                    </Box>
                    <Button variant="outlined" onClick={() => navigate("/home")} sx={{ borderColor: "#FF9839", color: "#FF9839", "&:hover": { borderColor: "#e68933", bgcolor: "rgba(255,152,57,0.1)" } }}>
                        Dashboard
                    </Button>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

                {/* Organization Settings */}
                <Paper sx={{ p: 4, mb: 4, borderRadius: 3, boxShadow: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#2c3e50", mb: 2 }}>
                        Workspace Details
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2 }}>
                        <TextField
                            label="Organization Name"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            disabled={!isEditingName || !isOwnerOrAdmin}
                            size="small"
                            sx={{ flexGrow: 1 }}
                        />
                        {isOwnerOrAdmin && (
                            isEditingName ? (
                                <>
                                    <Button variant="contained" onClick={handleSaveName} sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" } }}>Save</Button>
                                    <Button variant="outlined" onClick={() => { setIsEditingName(false); setOrgName(currentOrganization?.name || ""); }}>Cancel</Button>
                                </>
                            ) : (
                                <Button variant="outlined" onClick={() => setIsEditingName(true)} sx={{ color: "#34495e", borderColor: "#bdc3c7" }}>Edit Name</Button>
                            )
                        )}
                    </Box>
                    <Box sx={{ mt: 3, display: "flex", gap: 2, alignItems: "center", bgcolor: "#f8f9fa", p: 2, borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Slug: <strong style={{ color: "#2c3e50" }}>{currentOrganization?.slug}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Your Role: <Chip label={currentOrganization?.role?.toUpperCase()} size="small" sx={{ ml: 1, bgcolor: isOwner ? "#e3f2fd" : "#f1f5f9", color: isOwner ? "#1565c0" : "#475569", fontWeight: "bold" }} />
                        </Typography>
                    </Box>
                </Paper>

                {/* Billing & Subscription */}
                {isOwnerOrAdmin && plan && (
                    <Paper sx={{ p: 4, mb: 4, borderRadius: 3, boxShadow: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#2c3e50", mb: 2 }}>
                            Billing & Subscription
                        </Typography>
                        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, border: "1px solid #e2e8f0", borderRadius: 2 }}>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
                                    Current Plan: <strong style={{ marginLeft: 8 }}>{plan.name}</strong>
                                    <Chip label={plan.slug.toUpperCase()} size="small" sx={{ ml: 2, fontWeight: "bold" }} color={plan.slug === 'dev-free' ? 'default' : 'primary'} />
                                </Typography>
                                {plan.slug === 'dev-free' && (
                                    <Button variant="contained" sx={{ bgcolor: "#2ecc71", "&:hover": { bgcolor: "#27ae60" } }} onClick={async () => {
                                        try {
                                            const res = await apiClient.post('/billing/checkout', {
                                                planSlug: 'pro-monthly',
                                                successUrl: window.location.href,
                                                cancelUrl: window.location.href
                                            }, { headers: { "X-Organization-Id": currentOrganization.id } });
                                            if (res.data.session?.url) {
                                                window.location.href = res.data.session.url;
                                            }
                                        } catch (err) {
                                            setError("Checkout failed: " + (err.response?.data?.message || err.message));
                                        }
                                    }}>
                                        Upgrade to Pro
                                    </Button>
                                )}
                            </Box>
                            
                            {usage && entitlements && (
                                <Box sx={{ mt: 1 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, color: "#64748b", fontWeight: "bold" }}>Usage vs Limits</Typography>
                                    <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: "#f8f9fa" }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: "bold", color: "#475569" }}>Feature</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: "bold", color: "#475569" }}>Used</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: "bold", color: "#475569" }}>Limit</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell>Members</TableCell>
                                                    <TableCell align="right">{usage.members || members.length}</TableCell>
                                                    <TableCell align="right">{entitlements.limits?.members === -1 ? 'Unlimited' : entitlements.limits?.members || 'N/A'}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>Transcription (mins)</TableCell>
                                                    <TableCell align="right">{usage.transcription_minutes || 0}</TableCell>
                                                    <TableCell align="right">{entitlements.limits?.transcription_minutes === -1 ? 'Unlimited' : entitlements.limits?.transcription_minutes || 'N/A'}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>Storage (GB)</TableCell>
                                                    <TableCell align="right">{((usage.storage_gb || 0)).toFixed(2)}</TableCell>
                                                    <TableCell align="right">{entitlements.limits?.storage_gb === -1 ? 'Unlimited' : entitlements.limits?.storage_gb || 'N/A'}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>Ask Voom (queries)</TableCell>
                                                    <TableCell align="right">{usage.ask_voom || 0}</TableCell>
                                                    <TableCell align="right">{entitlements.limits?.ask_voom === -1 ? 'Unlimited' : entitlements.limits?.ask_voom || 'N/A'}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                )}

                {/* Member Management */}
                <Paper sx={{ p: 4, borderRadius: 3, boxShadow: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#2c3e50" }}>
                            Members ({members.length})
                        </Typography>
                        {isOwnerOrAdmin && (
                            <Button
                                variant="contained"
                                startIcon={<PersonAddIcon />}
                                onClick={() => setOpenAddDialog(true)}
                                sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" } }}
                            >
                                Add Member
                            </Button>
                        )}
                    </Box>

                    <TableContainer sx={{ border: "1px solid #e2e8f0", borderRadius: 2 }}>
                        <Table>
                            <TableHead sx={{ bgcolor: "#f8f9fa" }}>
                                <TableRow>
                                    <TableCell><strong>Name</strong></TableCell>
                                    <TableCell><strong>Username</strong></TableCell>
                                    <TableCell><strong>Role</strong></TableCell>
                                    {isOwnerOrAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell sx={{ fontWeight: 500 }}>{member.name}</TableCell>
                                        <TableCell color="text.secondary">{member.username}</TableCell>
                                        <TableCell>
                                            {isOwnerOrAdmin && member.role !== "owner" ? (
                                                <Select
                                                    value={member.role}
                                                    size="small"
                                                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                    sx={{ minWidth: 120 }}
                                                >
                                                    <MenuItem value="member">Member</MenuItem>
                                                    <MenuItem value="admin">Admin</MenuItem>
                                                    {isOwner && <MenuItem value="owner">Transfer Owner</MenuItem>}
                                                </Select>
                                            ) : (
                                                <Chip
                                                    label={member.role.toUpperCase()}
                                                    sx={{ bgcolor: member.role === "owner" ? "#e3f2fd" : "#f1f5f9", color: member.role === "owner" ? "#1565c0" : "#475569", fontWeight: "bold" }}
                                                    size="small"
                                                />
                                            )}
                                        </TableCell>
                                        {isOwnerOrAdmin && (
                                            <TableCell align="right">
                                                {member.role !== "owner" && (
                                                    <IconButton
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        title="Remove Member"
                                                    >
                                                        <DeleteOutlineIcon />
                                                    </IconButton>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                                {members.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                            No members found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* Add Member Dialog */}
                <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ fontWeight: 700 }}>Add Workspace Member</DialogTitle>
                    <DialogContent dividers>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Username"
                            fullWidth
                            variant="outlined"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            sx={{ mt: 1, mb: 3 }}
                        />
                        <Select
                            fullWidth
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            size="small"
                        >
                            <MenuItem value="member">Member</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenAddDialog(false)} sx={{ color: "text.secondary" }}>Cancel</Button>
                        <Button variant="contained" onClick={handleAddMember} sx={{ bgcolor: "#FF9839" }}>Add Member</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}

export default withAuth(OrganizationManagement);
