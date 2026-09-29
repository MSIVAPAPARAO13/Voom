import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Container, Typography, Box, Grid, Card, CardContent, Chip } from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import SecurityIcon from "@mui/icons-material/Security";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0B1020", color: "#f8fafc", overflowX: "hidden" }}>
      {/* Sticky Top Navigation */}
      <Box sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        px: { xs: 3, md: 6 },
        py: 2.5,
        bgcolor: "rgba(11, 16, 32, 0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        position: "sticky",
        top: 0,
        zIndex: 1100
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }} onClick={() => navigate("/")}>
          <Box sx={{
            width: 38,
            height: 38,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #FF9839 0%, #EA580C 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(255, 152, 57, 0.4)"
          }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "white", fontSize: "1.2rem", lineHeight: 1 }}>
              V
            </Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.5px", color: "#ffffff" }}>
            VOOM
          </Typography>
          <Chip label="v2.0" size="small" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, bgcolor: "rgba(255,152,57,0.15)", color: "#FF9839", border: "1px solid rgba(255,152,57,0.3)" }} />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, md: 2.5 } }}>
          <Button
            component={Link}
            to="/auth"
            sx={{
              color: "#94a3b8",
              fontWeight: 600,
              fontSize: "0.95rem",
              textTransform: "none",
              "&:hover": { color: "#ffffff", bgcolor: "rgba(255,255,255,0.05)" }
            }}
          >
            Sign In
          </Button>
          <Button
            component={Link}
            to="/auth"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: "#FF9839",
              color: "white",
              fontWeight: 700,
              fontSize: "0.95rem",
              textTransform: "none",
              px: 3,
              py: 1,
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(255, 152, 57, 0.35)",
              "&:hover": { bgcolor: "#e68933", boxShadow: "0 6px 24px rgba(255, 152, 57, 0.5)" }
            }}
          >
            Get Started
          </Button>
        </Box>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: 8, textAlign: "center", position: "relative" }}>
        {/* Ambient Gradient Glow */}
        <Box sx={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "320px", md: "700px" },
          height: "350px",
          background: "radial-gradient(circle, rgba(255, 152, 57, 0.12) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0
        }} />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 2, py: 0.75, borderRadius: "20px", bgcolor: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.1)", mb: 4 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10B981", boxShadow: "0 0 8px #10B981" }} />
            <Typography variant="body2" sx={{ color: "#cbd5e1", fontWeight: 600, fontSize: "0.85rem" }}>
              Enterprise-Grade WebRTC & AI Workspace
            </Typography>
          </Box>

          <Typography variant="h1" sx={{
            fontWeight: 900,
            fontSize: { xs: "2.8rem", md: "4.5rem", lg: "5.2rem" },
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
            mb: 3,
            color: "#ffffff"
          }}>
            Meet. Collaborate. <br />
            <span style={{
              background: "linear-gradient(135deg, #FF9839 0%, #F59E0B 50%, #EF4444 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}>
              Remember Everything.
            </span>
          </Typography>

          <Typography variant="h5" sx={{
            mb: 5,
            color: "#94a3b8",
            maxWidth: "780px",
            mx: "auto",
            fontSize: { xs: "1.1rem", md: "1.35rem" },
            lineHeight: 1.6,
            fontWeight: 400
          }}>
            Voom transforms real-time video conferencing into persistent team knowledge. Crystal-clear WebRTC, automatic transcription, and Ask Voom AI memory in a single unified workspace.
          </Typography>

          <Box sx={{ display: "flex", gap: 2.5, justifyContent: "center", flexWrap: "wrap", mb: 6 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate("/auth")}
              sx={{
                bgcolor: "#FF9839",
                color: "white",
                fontWeight: 800,
                fontSize: "1.1rem",
                textTransform: "none",
                px: 4.5,
                py: 1.8,
                borderRadius: "12px",
                boxShadow: "0 8px 30px rgba(255, 152, 57, 0.4)",
                "&:hover": { bgcolor: "#e68933", transform: "translateY(-2px)", transition: "all 0.2s ease" }
              }}
            >
              Start Meeting Free
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate("/auth")}
              sx={{
                borderColor: "rgba(255, 255, 255, 0.2)",
                color: "#e2e8f0",
                fontWeight: 700,
                fontSize: "1.1rem",
                textTransform: "none",
                px: 4,
                py: 1.8,
                borderRadius: "12px",
                bgcolor: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(10px)",
                "&:hover": { borderColor: "#FF9839", bgcolor: "rgba(255, 152, 57, 0.08)", color: "#FF9839" }
              }}
            >
              Explore AI Memory
            </Button>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "center", gap: { xs: 2, md: 4 }, flexWrap: "wrap", color: "#64748b", fontSize: "0.9rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#10B981" }} /> No credit card required
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#10B981" }} /> End-to-end multi-tenant isolation
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#10B981" }} /> Instant zero-latency join
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Hero Showcase Image */}
      <Container maxWidth="lg" sx={{ mb: 14 }}>
        <Box sx={{
          position: "relative",
          borderRadius: "20px",
          p: 1.5,
          bgcolor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(20px)"
        }}>
          <Box sx={{
            borderRadius: "16px",
            overflow: "hidden",
            position: "relative",
            aspectRatio: "16/9",
            bgcolor: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <img
              src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=1600&q=80"
              alt="Voom Collaboration Workspace"
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
            />
            {/* Overlay Banner */}
            <Box sx={{
              position: "absolute",
              bottom: 24,
              left: 24,
              right: 24,
              p: 3,
              borderRadius: "14px",
              bgcolor: "rgba(11, 16, 32, 0.88)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2
            }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#ffffff" }}>
                  Active Meeting: Architecture Review & AI Synchronization
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                  Full adaptive video stage • Realtime transcription • RAG vector memory
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate("/auth")}
                sx={{ bgcolor: "#FF9839", fontWeight: 700, textTransform: "none", borderRadius: "8px" }}
              >
                Join Live Demo
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Feature Cards Grid */}
      <Container maxWidth="lg" sx={{ mb: 16 }}>
        <Box sx={{ textAlign: "center", mb: 8 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: "#ffffff", letterSpacing: "-1px", mb: 2 }}>
            Engineered for Modern Teams
          </Typography>
          <Typography variant="h6" sx={{ color: "#94a3b8", maxWidth: "640px", mx: "auto", fontWeight: 400 }}>
            Every component designed to make meetings seamless, secure, and permanently searchable.
          </Typography>
        </Box>

        <Grid container spacing={3.5}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              height: "100%",
              bgcolor: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              transition: "all 0.25s ease",
              "&:hover": { borderColor: "rgba(255, 152, 57, 0.5)", transform: "translateY(-4px)", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }
            }}>
              <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ width: 52, height: 52, borderRadius: "12px", bgcolor: "rgba(255, 152, 57, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                  <VideoCallIcon sx={{ fontSize: 28, color: "#FF9839" }} />
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#ffffff", mb: 1.5 }}>
                  Full-Stage Video
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8", lineHeight: 1.6 }}>
                  Adaptive WebRTC layout with intelligent spotlighting, PIP self-view, and crisp screen sharing with zero lag.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              height: "100%",
              bgcolor: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              transition: "all 0.25s ease",
              "&:hover": { borderColor: "rgba(168, 85, 247, 0.5)", transform: "translateY(-4px)", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }
            }}>
              <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ width: 52, height: 52, borderRadius: "12px", bgcolor: "rgba(168, 85, 247, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 28, color: "#A855F7" }} />
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#ffffff", mb: 1.5 }}>
                  Ask Voom (RAG)
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8", lineHeight: 1.6 }}>
                  Query past decisions, action items, and technical context directly from team transcripts using AI vector memory.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              height: "100%",
              bgcolor: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              transition: "all 0.25s ease",
              "&:hover": { borderColor: "rgba(59, 130, 246, 0.5)", transform: "translateY(-4px)", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }
            }}>
              <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ width: 52, height: 52, borderRadius: "12px", bgcolor: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                  <RecordVoiceOverIcon sx={{ fontSize: 28, color: "#3B82F6" }} />
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#ffffff", mb: 1.5 }}>
                  BullMQ Pipelines
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8", lineHeight: 1.6 }}>
                  Asynchronous background processing with Redis, worker queues, and resilient multi-provider transcription fallback.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              height: "100%",
              bgcolor: "#111827",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              transition: "all 0.25s ease",
              "&:hover": { borderColor: "rgba(16, 185, 129, 0.5)", transform: "translateY(-4px)", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }
            }}>
              <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ width: 52, height: 52, borderRadius: "12px", bgcolor: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", mb: 2.5 }}>
                  <SecurityIcon sx={{ fontSize: 28, color: "#10B981" }} />
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#ffffff", mb: 1.5 }}>
                  Tenant Isolation
                </Typography>
                <Typography variant="body2" sx={{ color: "#94a3b8", lineHeight: 1.6 }}>
                  Multi-tenant RBAC ensuring organizations, meeting records, and vector embeddings are strictly compartmentalized.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Bottom CTA Banner */}
      <Box sx={{
        bgcolor: "#111827",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        py: { xs: 8, md: 10 },
        textAlign: "center"
      }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={800} sx={{ color: "#ffffff", mb: 2.5, letterSpacing: "-1px" }}>
            Turn every meeting into reusable knowledge.
          </Typography>
          <Typography variant="h6" sx={{ color: "#94a3b8", mb: 4, fontWeight: 400 }}>
            Meeting ➔ Recording ➔ Transcription ➔ Voom Memory ➔ Instant Recall
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/auth")}
            sx={{
              bgcolor: "#FF9839",
              color: "white",
              fontWeight: 800,
              fontSize: "1.15rem",
              textTransform: "none",
              px: 5,
              py: 1.8,
              borderRadius: "12px",
              boxShadow: "0 8px 30px rgba(255, 152, 57, 0.4)",
              "&:hover": { bgcolor: "#e68933" }
            }}
          >
            Get Started with Voom
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 4, textAlign: "center", borderTop: "1px solid rgba(255, 255, 255, 0.05)", bgcolor: "#0B1020" }}>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          © 2026 Voom Conferencing Technologies Inc. All rights reserved. • <span style={{ color: "#10B981" }}>● All Systems Operational</span>
        </Typography>
      </Box>
    </Box>
  );
}

export default LandingPage;
