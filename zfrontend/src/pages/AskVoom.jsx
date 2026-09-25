import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Container, Typography, Paper, Box, TextField, Button,
    CircularProgress, Alert, Card, CardContent, Chip, Grid,
    IconButton
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import HomeIcon from "@mui/icons-material/Home";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import { OrganizationContext } from "../contexts/OrganizationContext";
import { apiClient } from "../services/apiClient";
import withAuth from "../utils/withAuth";

const EXAMPLE_QUESTIONS = [
    "What did we decide about the Q3 budget?",
    "What were the action items from the last sprint review?",
    "What did the team decide about authentication?",
    "Which deployment blockers were discussed?"
];

function AskVoom() {
    const navigate = useNavigate();
    const { currentOrganization } = useContext(OrganizationContext);
    
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    const [answer, setAnswer] = useState("");
    const [sources, setSources] = useState([]);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        setAnswer("");
        setSources([]);
        setQuestion("");
        setSearched(false);
        setError("");
    }, [currentOrganization]);

    const handleAsk = async (e) => {
        e?.preventDefault();
        if (!question.trim() || !currentOrganization) return;

        setLoading(true);
        setError("");
        setAnswer("");
        setSources([]);
        setSearched(true);

        try {
            const res = await apiClient.post(`/organizations/${currentOrganization.id}/ask`, {
                question: question.trim()
            });

            if (res.data?.success) {
                setAnswer(res.data.answer || "Voom couldn't find relevant meeting knowledge.");
                setSources(res.data.sources || []);
            } else {
                setError(res.data?.message || "Failed to get answer");
            }
        } catch (err) {
            setError(err.response?.data?.message || "An error occurred while asking Voom.");
        } finally {
            setLoading(false);
        }
    };

    const handleSourceClick = (source) => {
        if (source.meetingCode) {
            navigate(`/${source.meetingCode}?t=${Math.floor(source.timestamp || 0)}`);
        }
    };

    const formatTimestamp = (secs) => {
        if (secs === null || secs === undefined) return "";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `[${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`;
    };

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa", pt: 4, pb: 8 }}>
            <Container maxWidth="md">
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                    <IconButton onClick={() => navigate("/home")} sx={{ color: "#FF9839" }}>
                        <HomeIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#2c3e50" }}>
                        Dashboard
                    </Typography>
                </Box>

                <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, boxShadow: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                        <AutoAwesomeIcon sx={{ fontSize: 40, color: "#FF9839" }} />
                        <Typography variant="h4" fontWeight="800" color="#2c3e50">
                            Ask Voom
                        </Typography>
                    </Box>
                    <Typography variant="subtitle1" color="text.secondary" paragraph sx={{ fontSize: "1.1rem", mb: 4 }}>
                        Search everything {currentOrganization?.name ? `${currentOrganization.name} has` : "your organization has"} learned from past meetings.
                    </Typography>

                    {!currentOrganization ? (
                        <Alert severity="warning">Please select an organization on the Dashboard to use Ask Voom.</Alert>
                    ) : (
                        <Box component="form" onSubmit={handleAsk} sx={{ mb: 5 }}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    placeholder="Ask anything about your team's meetings..."
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    disabled={loading}
                                    InputProps={{ sx: { borderRadius: 2, fontSize: "1.1rem", p: 0.5 } }}
                                />
                                <Button
                                    variant="contained"
                                    type="submit"
                                    disabled={!question.trim() || loading}
                                    sx={{ minWidth: 140, bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" }, borderRadius: 2, fontSize: "1.1rem" }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : "Ask Voom"}
                                </Button>
                            </Box>

                            {!searched && (
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" mb={2}>
                                        Try asking:
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {EXAMPLE_QUESTIONS.map((ex, i) => (
                                            <Grid item xs={12} sm={6} key={i}>
                                                <Card 
                                                    variant="outlined" 
                                                    onClick={() => setQuestion(ex)}
                                                    sx={{ 
                                                        cursor: "pointer", 
                                                        transition: "0.2s", 
                                                        "&:hover": { borderColor: "#FF9839", bgcolor: "rgba(255,152,57,0.05)" }
                                                    }}
                                                >
                                                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                                        <Typography variant="body2" color="text.primary">"{ex}"</Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            )}
                        </Box>
                    )}

                    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                    {loading && (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 5 }}>
                            <CircularProgress size={40} sx={{ color: "#FF9839", mb: 2 }} />
                            <Typography color="text.secondary">Searching your meeting knowledge...</Typography>
                        </Box>
                    )}

                    {searched && !loading && !error && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#2c3e50" }}>
                                Answer
                            </Typography>
                            <Paper elevation={0} sx={{ p: 3, bgcolor: '#f8f9fa', mb: 4, borderRadius: 2, border: "1px solid #e0e0e0" }}>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                                    {answer}
                                </Typography>
                            </Paper>

                            {sources.length > 0 && (
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#2c3e50" }}>
                                        Sources
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {sources.map((src, idx) => (
                                            <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: "wrap", gap: 1 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Chip label={`Source ${src.sourceNumber}`} size="small" sx={{ bgcolor: "#e3f2fd", color: "#1565c0", fontWeight: "bold" }} />
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                {src.meetingTitle || src.meetingCode}
                                                            </Typography>
                                                        </Box>
                                                        <Button 
                                                            size="small" 
                                                            variant="outlined"
                                                            startIcon={<VideoCameraFrontIcon />}
                                                            onClick={() => handleSourceClick(src)}
                                                            disabled={src.timestamp === null}
                                                            sx={{ borderColor: "#bdc3c7", color: "#34495e" }}
                                                        >
                                                            {src.timestamp !== null ? `Jump to ${formatTimestamp(src.timestamp)}` : 'Open Meeting'}
                                                        </Button>
                                                    </Box>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", bgcolor: "#f5f7fa", p: 1.5, borderRadius: 1, mt: 2 }}>
                                                        "{src.text}"
                                                    </Typography>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                </Paper>
            </Container>
        </Box>
    );
}

export default withAuth(AskVoom);
