import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Typography from "@mui/material/Typography";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { AuthContext } from "../contexts/AuthContext";
import { Snackbar, Alert, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";

const theme = createTheme({
  palette: {
    primary: {
      main: "#FF9839",
    },
    secondary: {
      main: "#2c3e50",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default function Authentication() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  
  const navigate = useNavigate();
  const { handleRegister, handleLogin } = React.useContext(AuthContext);

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
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
        <CssBaseline />
        
        {/* Left Side: Hero Image Banner */}
        <Box
          sx={{
            flex: { xs: 0, md: 1.2 },
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(255,152,57,0.95) 0%, rgba(44,62,80,0.95) 100%), url(https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: 'white',
            p: 6,
            textAlign: 'center',
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)'
          }}
        >
          <Typography variant="h2" fontWeight="900" gutterBottom sx={{ 
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontSize: { md: '3.5rem', lg: '4.5rem' },
            letterSpacing: '-1px'
          }}>
            Voom
          </Typography>
          <Typography variant="h5" maxWidth="600px" sx={{ 
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontSize: { md: '1.2rem', lg: '1.4rem' },
            lineHeight: 1.6,
            opacity: 0.9
          }}>
            Turn every meeting into reusable knowledge. Persistent workspaces, multi-tenant organizations, and RAG capabilities.
          </Typography>
        </Box>

        {/* Right Side: Authentication Form */}
        <Box 
          component={Paper} 
          elevation={24} 
          square 
          sx={{ 
            flex: 1,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            bgcolor: '#fdfbfb',
            zIndex: 10
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: '100%',
              maxWidth: 440,
              p: { xs: 4, md: 6 }
            }}
          >
            <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Avatar sx={{ m: 1, bgcolor: "#FF9839", width: 64, height: 64, boxShadow: '0 8px 24px rgba(255,152,57,0.4)' }}>
                <LockOutlinedIcon fontSize="large" sx={{ color: 'white' }} />
              </Avatar>
              <Typography component="h1" variant="h4" fontWeight="800" sx={{ mt: 2, color: '#2c3e50', letterSpacing: '-0.5px' }}>
                {formState === 0 ? "Welcome back" : "Create account"}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {formState === 0 ? "Enter your details to access your workspace." : "Join Voom and start collaborating instantly."}
              </Typography>
            </Box>

            <Box sx={{ width: '100%', display: 'flex', p: 0.5, bgcolor: '#f1f3f5', borderRadius: 3, mb: 4 }}>
              <Button
                fullWidth
                disableElevation
                variant={formState === 0 ? "contained" : "text"}
                onClick={() => { setFormState(0); setError(""); }}
                sx={{ 
                  borderRadius: 2, 
                  py: 1, 
                  fontWeight: formState === 0 ? 'bold' : 'medium',
                  color: formState === 0 ? 'white' : '#7f8c8d',
                  bgcolor: formState === 0 ? '#2c3e50' : 'transparent',
                  '&:hover': { bgcolor: formState === 0 ? '#1a252f' : 'rgba(0,0,0,0.05)' }
                }}
              >
                Sign In
              </Button>
              <Button
                fullWidth
                disableElevation
                variant={formState === 1 ? "contained" : "text"}
                onClick={() => { setFormState(1); setError(""); }}
                sx={{ 
                  borderRadius: 2, 
                  py: 1, 
                  fontWeight: formState === 1 ? 'bold' : 'medium',
                  color: formState === 1 ? 'white' : '#7f8c8d',
                  bgcolor: formState === 1 ? '#2c3e50' : 'transparent',
                  '&:hover': { bgcolor: formState === 1 ? '#1a252f' : 'rgba(0,0,0,0.05)' }
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
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2, width: '100%', borderRadius: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ 
                  mt: 4, mb: 2, 
                  py: 1.8, 
                  borderRadius: 2, 
                  fontWeight: 'bold', 
                  fontSize: '1.1rem',
                  boxShadow: '0 8px 24px rgba(255,152,57,0.3)',
                  '&:hover': { boxShadow: '0 12px 32px rgba(255,152,57,0.4)' }
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
        <Alert onClose={() => setOpen(false)} severity="success" sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
