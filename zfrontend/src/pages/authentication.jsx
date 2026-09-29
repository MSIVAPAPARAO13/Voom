import React, { useState, useContext } from 'react';
import { Box, Button, TextField, Typography, Paper, Alert, Avatar, CssBaseline, ThemeProvider, createTheme, CircularProgress, Snackbar } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

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

export default function Authentication() {
  const [formState, setFormState] = useState(0); // 0: Login, 1: Register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { handleLogin, handleRegister } = useContext(AuthContext);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (formState === 0) {
        let result = await handleLogin(username, password);
        setMessage(result?.message || "Login successful");
        setOpen(true);
        navigate("/home");
      } else {
        let result = await handleRegister(name, username, password);
        setUsername("");
        setPassword("");
        setName("");
        setMessage(result?.message || "Registration successful! Please login.");
        setOpen(true);
        setFormState(0);
      }
    } catch (err) {
      let msg = err?.response?.data?.message || "Something went wrong. Please check your connection.";
      if (err?.response?.status === 401) msg = "Invalid username or password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', width: '100vw', bgcolor: '#0B1020' }}>
        <CssBaseline />
        
        {/* Left Side: Hero Image Banner */}
        <Box
          sx={{
            flex: { xs: 0, md: 1.1 },
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            background: 'linear-gradient(135deg, rgba(11, 16, 32, 0.95) 0%, rgba(17, 24, 39, 0.92) 100%), url(https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: 'white',
            p: 8,
            borderRight: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          {/* Logo Badge */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 6, cursor: "pointer" }} onClick={() => navigate("/")}>
            <Box sx={{
              width: 42,
              height: 42,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #FF9839 0%, #EA580C 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(255, 152, 57, 0.4)"
            }}>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "white" }}>V</Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.5px" }}>VOOM</Typography>
          </Box>

          <Typography variant="h2" fontWeight="900" gutterBottom sx={{ 
            fontSize: { md: '3rem', lg: '3.6rem' },
            letterSpacing: '-1px',
            lineHeight: 1.15
          }}>
            Meet. Collaborate. <br />
            <span style={{ color: '#FF9839' }}>Remember.</span>
          </Typography>
          <Typography variant="body1" sx={{ 
            fontSize: '1.15rem',
            lineHeight: 1.6,
            color: '#94a3b8',
            maxWidth: '520px',
            mb: 5
          }}>
            Turn every meeting into reusable enterprise knowledge with WebRTC real-time conferencing, persistent chat, and Ask Voom vector memory.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#cbd5e1' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleOutlineIcon sx={{ color: '#10B981', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Zero-setup instant audio & video meetings</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleOutlineIcon sx={{ color: '#10B981', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Automated transcripts and AI intelligence</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleOutlineIcon sx={{ color: '#10B981', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Multi-tenant workspace isolation & RBAC</Typography>
            </Box>
          </Box>
        </Box>

        {/* Right Side: Authentication Form */}
        <Box 
          component={Paper} 
          elevation={0}
          square 
          sx={{ 
            flex: 1,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            bgcolor: '#0B1020',
            zIndex: 10,
            p: 3
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: '100%',
              maxWidth: 440,
              p: { xs: 3, md: 5 },
              bgcolor: '#111827',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}
          >
            <Box sx={{ mb: 3.5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ m: 1, bgcolor: "rgba(255, 152, 57, 0.15)", width: 56, height: 56, border: '1px solid rgba(255, 152, 57, 0.3)' }}>
                <LockOutlinedIcon sx={{ color: '#FF9839', fontSize: 28 }} />
              </Avatar>
              <Typography component="h1" variant="h5" fontWeight="800" sx={{ mt: 1.5, color: '#ffffff', letterSpacing: '-0.5px' }}>
                {formState === 0 ? "Sign in to Voom" : "Create your account"}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: '#94a3b8' }}>
                {formState === 0 ? "Enter your credentials to access your workspace" : "Get started with your free enterprise workspace"}
              </Typography>
            </Box>

            {/* Switch Tabs (Sign In / Sign Up) */}
            <Box sx={{ width: '100%', display: 'flex', p: 0.5, bgcolor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', mb: 3.5, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Button
                fullWidth
                disableElevation
                variant="text"
                onClick={() => { setFormState(0); setError(""); }}
                sx={{ 
                  borderRadius: '10px', 
                  py: 1, 
                  fontWeight: formState === 0 ? 700 : 500,
                  color: formState === 0 ? '#ffffff' : '#94a3b8',
                  bgcolor: formState === 0 ? '#1E293B' : 'transparent',
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  boxShadow: formState === 0 ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  '&:hover': { bgcolor: formState === 0 ? '#1E293B' : 'rgba(255,255,255,0.04)' }
                }}
              >
                Sign In
              </Button>
              <Button
                fullWidth
                disableElevation
                variant="text"
                onClick={() => { setFormState(1); setError(""); }}
                sx={{ 
                  borderRadius: '10px', 
                  py: 1, 
                  fontWeight: formState === 1 ? 700 : 500,
                  color: formState === 1 ? '#ffffff' : '#94a3b8',
                  bgcolor: formState === 1 ? '#1E293B' : 'transparent',
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  boxShadow: formState === 1 ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  '&:hover': { bgcolor: formState === 1 ? '#1E293B' : 'rgba(255,255,255,0.04)' }
                }}
              >
                Sign Up
              </Button>
            </Box>

            <Box component="form" onSubmit={handleAuth} noValidate sx={{ width: '100%' }}>
              {formState === 1 && (
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="name"
                  label="Full Name"
                  name="name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  sx={{
                    mb: 1.5,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      bgcolor: 'rgba(255, 255, 255, 0.03)',
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                      '&.Mui-focused fieldset': { borderColor: '#FF9839' }
                    }
                  }}
                />
              )}

              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                value={username}
                autoFocus={formState === 0}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF9839' }
                  }
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                id="password"
                disabled={loading}
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#FF9839' }
                  }
                }}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 1, width: '100%', borderRadius: '10px' }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ 
                  mt: 3, mb: 2, 
                  py: 1.6, 
                  borderRadius: '10px', 
                  fontWeight: 800, 
                  fontSize: '1rem',
                  textTransform: 'none',
                  bgcolor: '#FF9839',
                  boxShadow: '0 8px 24px rgba(255,152,57,0.3)',
                  '&:hover': { bgcolor: '#e68933', boxShadow: '0 12px 32px rgba(255,152,57,0.45)' }
                }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : (formState === 0 ? "SIGN IN TO WORKSPACE" : "CREATE ACCOUNT")}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
      <Snackbar open={open} autoHideDuration={4000} onClose={() => setOpen(false)}>
        <Alert severity="success" sx={{ width: '100%', borderRadius: '10px' }}>
          {message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
