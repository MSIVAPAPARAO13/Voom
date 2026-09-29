import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Container, Typography, Paper, Box, TextField, Button,
    CircularProgress, Alert, Card, CardContent, Chip, Grid,
    ThemeProvider, createTheme, CssBaseline
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { OrganizationContext } from "../contexts/OrganizationContext";
import { apiClient } from "../services/apiClient";
import withAuth from "../utils/withAuth";

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#FF9839' },
        background: { default: '#0B1020', paper: '#111827' },
        text: { primary: '#f8fafc', secondary: '#94a3b8' }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
});

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
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Box sx={{ minHeight: "100vh", bgcolor: "#0B1020", color: "#f8fafc", pt: 3, pb: 8 }}>
                <Container maxWidth="md">
                    {/* Top Navigation Bar */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate("/home")}
                            sx={{ color: "#94a3b8", textTransform: "none", fontWeight: 600, "&:hover": { color: "#ffffff", bgcolor: "rgba(255,255,255,0.05)" } }}
                        >
                            Back to Dashboard
                        </Button>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{
                                width: 28, height: 28, borderRadius: "6px",
                                background: "linear-gradient(135deg, #FF9839 0%, #EA580C 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <Typography sx={{ fontWeight: 900, color: "white", fontSize: "0.85rem" }}>V</Typography>
                            </Box>
                            <Typography variant="subtitle1" fontWeight={800} sx={{ color: "#ffffff", letterSpacing: "-0.5px" }}>VOOM MEMORY</Typography>
                        </Box>
                    </Box>

                    <Paper sx={{
                        p: { xs: 3, md: 5 },
                        borderRadius: "20px",
                        bgcolor: "#111827",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
                    }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5 }}>
                            <Box sx={{ width: 50, height: 50, borderRadius: "12px", bgcolor: "rgba(255, 152, 57, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <AutoAwesomeIcon sx={{ fontSize: 30, color: "#FF9839" }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" fontWeight={900} sx={{ color: "#ffffff", letterSpacing: "-0.5px" }}>
                                    Ask Voom
                                </Typography>
                                <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                                    AI-powered vector search across {currentOrganization?.name ? currentOrganization.name : "your organization"}'s meeting transcripts.
                                </Typography>
                            </Box>
                        </Box>

                        {!currentOrganization ? (
                            <Alert severity="warning" sx={{ mt: 3, borderRadius: "10px" }}>Please select an organization on the Dashboard to use Ask Voom.</Alert>
                        ) : (
                            <Box component="form" onSubmit={handleAsk} sx={{ mt: 4, mb: 4 }}>
                                <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        placeholder="Ask anything about your team's meetings, decisions, or action items..."
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        disabled={loading}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: "12px",
                                                bgcolor: "rgba(255, 255, 255, 0.03)",
                                                fontSize: "1.05rem",
                                                '& fieldset': { borderColor: "rgba(255, 255, 255, 0.12)" },
                                                '&:hover fieldset': { borderColor: "rgba(255, 255, 255, 0.25)" },
                                                '&.Mui-focused fieldset': { borderColor: "#FF9839" }
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="contained"
                                        type="submit"
                                        disabled={!question.trim() || loading}
                                        sx={{
                                            minWidth: 130,
                                            bgcolor: "#FF9839",
                                            color: "white",
                                            fontWeight: 700,
                                            borderRadius: "12px",
                                            textTransform: "none",
                                            fontSize: "1rem",
                                            boxShadow: "0 4px 14px rgba(255,152,57,0.3)",
                                            "&:hover": { bgcolor: "#e68933" }
                                        }}
                                    >
                                        {loading ? <CircularProgress size={24} color="inherit" /> : "Ask"}
                                    </Button>
                                </Box>

                                {!searched && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", display: "block", mb: 1.5 }}>
                                            Suggested Inquiries
                                        </Typography>
                                        <Grid container spacing={1.5}>
                                            {EXAMPLE_QUESTIONS.map((ex, i) => (
                                                <Grid item xs={12} sm={6} key={i}>
                                                    <Card 
                                                        variant="outlined" 
                                                        onClick={() => setQuestion(ex)}
                                                        sx={{ 
                                                            cursor: "pointer", 
                                                            bgcolor: "rgba(255, 255, 255, 0.02)",
                                                            borderColor: "rgba(255, 255, 255, 0.08)",
                                                            borderRadius: "10px",
                                                            transition: "all 0.2s ease", 
                                                            "&:hover": { borderColor: "#FF9839", bgcolor: "rgba(255,152,57,0.06)", transform: "translateY(-1px)" }
                                                        }}
                                                    >
                                                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                                            <Typography variant="body2" sx={{ color: "#cbd5e1" }}>"{ex}"</Typography>
                                                        </CardContent>
                                                    </Card>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: "10px" }}>{error}</Alert>}

                        {loading && (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6 }}>
                                <CircularProgress size={42} sx={{ color: "#FF9839", mb: 2 }} />
                                <Typography variant="body2" sx={{ color: "#94a3b8" }}>Searching vector embeddings across meetings...</Typography>
                            </Box>
                        )}

                        {searched && !loading && !error && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ color: "#ffffff", mb: 1.5 }}>
                                    Synthesized Answer
                                </Typography>
                                <Paper elevation={0} sx={{
                                    p: 3,
                                    bgcolor: '#1E293B',
                                    mb: 4,
                                    borderRadius: "14px",
                                    border: "1px solid rgba(255, 255, 255, 0.08)"
                                }}>
                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: "#f8fafc" }}>
                                        {answer}
                                    </Typography>
                                </Paper>

                                {sources.length > 0 && (
                                    <Box>
                                        <Typography variant="h6" fontWeight={700} sx={{ color: "#ffffff", mb: 2 }}>
                                            Referenced Sources ({sources.length})
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {sources.map((src, idx) => (
                                                <Card key={idx} sx={{
                                                    borderRadius: "12px",
                                                    bgcolor: "rgba(255, 255, 255, 0.03)",
                                                    border: "1px solid rgba(255, 255, 255, 0.08)"
                                                }}>
                                                    <CardContent sx={{ p: 2.5 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                                <Chip label={`Source #${src.sourceNumber}`} size="small" sx={{ bgcolor: "rgba(59, 130, 246, 0.2)", color: "#60A5FA", fontWeight: 700, borderRadius: "6px" }} />
                                                                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#ffffff" }}>
                                                                    {src.meetingTitle || src.meetingCode}
                                                                </Typography>
                                                            </Box>
                                                            <Button 
                                                                size="small" 
                                                                variant="outlined"
                                                                startIcon={<VideoCameraFrontIcon />}
                                                                onClick={() => handleSourceClick(src)}
                                                                disabled={src.timestamp === null}
                                                                sx={{
                                                                    borderColor: "rgba(255, 255, 255, 0.15)",
                                                                    color: "#94a3b8",
                                                                    borderRadius: "8px",
                                                                    textTransform: "none",
                                                                    fontSize: "0.8rem",
                                                                    "&:hover": { borderColor: "#FF9839", color: "#FF9839" }
                                                                }}
                                                            >
                                                                {src.timestamp !== null ? `Jump to ${formatTimestamp(src.timestamp)}` : 'Open Meeting'}
                                                            </Button>
                                                        </Box>
                                                        <Typography variant="body2" sx={{ fontStyle: "italic", bgcolor: "rgba(0, 0, 0, 0.25)", p: 2, borderRadius: "8px", color: "#cbd5e1", borderLeft: "3px solid #FF9839" }}>
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
        </ThemeProvider>
    );
}

export default withAuth(AskVoom);
