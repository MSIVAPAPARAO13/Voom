import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Container,
    Typography,
    Paper,
    Box,
    TextField,
    Button,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemText,
    Chip,
    Divider,
    Card,
    CardContent,
    Link as MuiLink
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { OrganizationContext } from "../contexts/OrganizationContext";
import { apiClient } from "../services/apiClient";
import withAuth from "../utils/withAuth";
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';

function AskVoom() {
    const navigate = useNavigate();
    const { currentOrganization } = useContext(OrganizationContext);
    
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    const [answer, setAnswer] = useState("");
    const [sources, setSources] = useState([]);
    const [searched, setSearched] = useState(false);

    // Clear state when organization changes
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
                setAnswer(res.data.answer);
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
        // Navigate to the video meeting playback page, jumping to the specific timestamp
        if (source.meetingCode) {
            navigate(`/${source.meetingCode}?t=${Math.floor(source.timestamp)}`);
        }
    };

    const formatTimestamp = (secs) => {
        if (secs === null || secs === undefined) return "";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `[${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`;
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Paper sx={{ p: 4, borderRadius: 2 }}>
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    Ask Voom
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Search across {currentOrganization?.name || "your organization"}'s historical meeting knowledge.
                </Typography>

                {!currentOrganization ? (
                    <Alert severity="warning">Please select an organization to use Ask Voom.</Alert>
                ) : (
                    <Box component="form" onSubmit={handleAsk} sx={{ display: 'flex', gap: 2, mb: 4 }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="e.g. What did we decide about authentication?"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            disabled={loading}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            type="submit"
                            disabled={!question.trim() || loading}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                            sx={{ minWidth: 120 }}
                        >
                            Ask
                        </Button>
                    </Box>
                )}

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {searched && !loading && !error && (
                    <Box>
                        <Typography variant="h6" gutterBottom>Answer</Typography>
                        <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50', mb: 4, borderRadius: 2 }}>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                {answer}
                            </Typography>
                        </Paper>

                        {sources.length > 0 && (
                            <Box>
                                <Typography variant="h6" gutterBottom>Sources</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {sources.map((src, idx) => (
                                        <Card key={idx} variant="outlined">
                                            <CardContent>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Chip label={`Source ${src.sourceNumber}`} size="small" color="primary" variant="outlined" />
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {src.meetingTitle || src.meetingCode}
                                                        </Typography>
                                                    </Box>
                                                    <Button 
                                                        size="small" 
                                                        startIcon={<VideoCameraFrontIcon />}
                                                        onClick={() => handleSourceClick(src)}
                                                        disabled={src.timestamp === null}
                                                    >
                                                        {src.timestamp !== null ? `Jump to ${formatTimestamp(src.timestamp)}` : 'Open Meeting'}
                                                    </Button>
                                                </Box>
                                                <Typography variant="body2" color="text.secondary">
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
    );
}

export default withAuth(AskVoom);
