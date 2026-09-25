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
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                <IconButton onClick={() => navigate("/home")} sx={{ mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" component="h1" sx={{ flexGrow: 1, fontWeight: "bold" }}>
                    Organization Management
                </Typography>
                <Button variant="outlined" onClick={() => navigate("/home")}>
                    Back to Home
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            {/* Organization Settings */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Organization Details
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
                                <Button variant="contained" onClick={handleSaveName}>Save</Button>
                                <Button variant="outlined" onClick={() => { setIsEditingName(false); setOrgName(currentOrganization?.name || ""); }}>Cancel</Button>
                            </>
                        ) : (
                            <Button variant="outlined" onClick={() => setIsEditingName(true)}>Edit Name</Button>
                        )
                    )}
                </Box>
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                        Slug: <strong>{currentOrganization?.slug}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Your Role: <Chip label={currentOrganization?.role?.toUpperCase()} size="small" color={isOwner ? "primary" : "default"} />
                    </Typography>
                </Box>
            </Paper>

            {/* Billing & Subscription */}
            {isOwnerOrAdmin && plan && (
                <Paper sx={{ p: 3, mb: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        Billing & Subscription
                    </Typography>
                    <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body1">
                                Current Plan: <strong>{plan.name}</strong>
                                <Chip label={plan.slug.toUpperCase()} size="small" sx={{ ml: 1 }} color={plan.slug === 'dev-free' ? 'default' : 'primary'} />
                            </Typography>
                            {plan.slug === 'dev-free' && (
                                <Button variant="contained" color="primary" onClick={async () => {
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
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>Usage vs Limits</Typography>
                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Feature</TableCell>
                                                <TableCell align="right">Used</TableCell>
                                                <TableCell align="right">Limit</TableCell>
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
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6">
                        Members ({members.length})
                    </Typography>
                    {isOwnerOrAdmin && (
                        <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={() => setOpenAddDialog(true)}
                        >
                            Add Member
                        </Button>
                    )}
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
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
                                    <TableCell>{member.name}</TableCell>
                                    <TableCell>{member.username}</TableCell>
                                    <TableCell>
                                        {isOwnerOrAdmin && member.role !== "owner" ? (
                                            <Select
                                                value={member.role}
                                                size="small"
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            >
                                                <MenuItem value="member">Member</MenuItem>
                                                <MenuItem value="admin">Admin</MenuItem>
                                                {isOwner && <MenuItem value="owner">Transfer Owner</MenuItem>}
                                            </Select>
                                        ) : (
                                            <Chip
                                                label={member.role.toUpperCase()}
                                                color={member.role === "owner" ? "primary" : member.role === "admin" ? "secondary" : "default"}
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
                                    <TableCell colSpan={4} align="center">
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
                <DialogTitle>Add Member</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Username"
                        fullWidth
                        variant="outlined"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        sx={{ mt: 1, mb: 2 }}
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
                <DialogActions>
                    <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddMember}>Add</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

export default withAuth(OrganizationManagement);
