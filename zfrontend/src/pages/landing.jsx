import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Container, Typography, Box, Grid, Card, CardContent } from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import SecurityIcon from "@mui/icons-material/Security";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa" }}>
      {/* Navigation */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 3, bgcolor: "white", boxShadow: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "#FF9839" }}>
          Voom
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button component={Link} to="/auth" color="inherit">Join as Guest</Button>
          <Button component={Link} to="/auth" color="inherit">Login</Button>
          <Button component={Link} to="/auth" variant="contained" sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" } }}>
            Register
          </Button>
        </Box>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ mt: 8, mb: 8, textAlign: "center" }}>
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 3, color: "#2c3e50" }}>
          Meet. Collaborate. <span style={{ color: "#FF9839" }}>Remember.</span>
        </Typography>
        <Typography variant="h5" sx={{ mb: 5, color: "#7f8c8d", maxWidth: "800px", mx: "auto" }}>
          Voom brings video meetings, persistent collaboration, recordings, searchable transcripts, and AI-powered meeting memory into one workspace.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button variant="contained" size="large" onClick={() => navigate("/auth")} sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" }, px: 4, py: 1.5, fontSize: "1.1rem" }}>
            Start for free
          </Button>
          <Button variant="outlined" size="large" sx={{ borderColor: "#FF9839", color: "#FF9839", "&:hover": { borderColor: "#e68933", bgcolor: "rgba(255,152,57,0.1)" }, px: 4, py: 1.5, fontSize: "1.1rem" }}>
            Explore Voom
          </Button>
        </Box>
      </Container>

      {/* Hero Image Section */}
      <Container maxWidth="lg" sx={{ mb: 10, textAlign: "center" }}>
        <Box sx={{
          width: '100%',
          maxWidth: '900px',
          mx: 'auto',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid rgba(255,255,255,0.5)'
        }}>
          <img src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=1200&q=80" alt="Voom Collaboration Workspace" style={{ width: '100%', display: 'block' }} />
        </Box>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ mb: 10 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 5, textAlign: "center", color: "#2c3e50" }}>
          Everything you need for modern teams
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: "100%", boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: "center", p: 4 }}>
                <VideoCallIcon sx={{ fontSize: 60, color: "#FF9839", mb: 2 }} />
                <Typography variant="h6" gutterBottom fontWeight="bold">HD Video Meetings</Typography>
                <Typography color="text.secondary">Low-latency, peer-to-peer WebRTC video collaboration for teams of all sizes.</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: "100%", boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: "center", p: 4 }}>
                <AutoAwesomeIcon sx={{ fontSize: 60, color: "#9b59b6", mb: 2 }} />
                <Typography variant="h6" gutterBottom fontWeight="bold">AI Meeting Insights</Typography>
                <Typography color="text.secondary">Automatically generate executive summaries, action items, and knowledge bases.</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: "100%", boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: "center", p: 4 }}>
                <RecordVoiceOverIcon sx={{ fontSize: 60, color: "#3498db", mb: 2 }} />
                <Typography variant="h6" gutterBottom fontWeight="bold">Searchable Transcripts</Typography>
                <Typography color="text.secondary">Every recording is transcribed and synced to our RAG knowledge search engine.</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: "100%", boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: "center", p: 4 }}>
                <SecurityIcon sx={{ fontSize: 60, color: "#2ecc71", mb: 2 }} />
                <Typography variant="h6" gutterBottom fontWeight="bold">Enterprise Security</Typography>
                <Typography color="text.secondary">Strict multi-tenant organization isolation and robust role-based access control.</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box sx={{ bgcolor: "#2c3e50", color: "white", py: 10, textAlign: "center" }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          Turn every meeting into reusable knowledge.
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 4, color: "#bdc3c7" }}>
          Meeting ➔ Transcript ➔ Knowledge ➔ Ask Voom
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate("/auth")} sx={{ bgcolor: "#FF9839", "&:hover": { bgcolor: "#e68933" }, px: 4, py: 1.5, fontSize: "1.1rem" }}>
          Get Started Today
        </Button>
      </Box>
    </Box>
  );
}

export default LandingPage;
