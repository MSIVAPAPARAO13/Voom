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
      <Grid container component="main" sx={{ height: "100vh" }}>
        <CssBaseline />
        <Grid
          item
          xs={false}
          sm={4}
          md={7}
          sx={{
            background: "linear-gradient(135deg, #FF9839 0%, #e67e22 100%)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            p: 4
          }}
        >
          <Typography variant="h2" fontWeight="bold" gutterBottom>
            Voom
          </Typography>
          <Typography variant="h5" textAlign="center" maxWidth="600px">
            Turn every meeting into reusable knowledge. Persistent workspaces, multi-tenant organizations, and RAG capabilities.
          </Typography>
        </Grid>
        <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
          <Box
            sx={{
              my: 12,
              mx: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: "primary.main", width: 56, height: 56 }}>
              <LockOutlinedIcon fontSize="large" />
            </Avatar>
            <Typography component="h1" variant="h5" fontWeight="bold" sx={{ mt: 2 }}>
              {formState === 0 ? "Welcome back" : "Create your account"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              {formState === 0 ? "Continue your meetings, teams, and knowledge." : "Join Voom and start collaborating instantly."}
            </Typography>

            <Box sx={{ width: '100%', display: 'flex', gap: 2, mb: 3 }}>
              <Button
                fullWidth
                variant={formState === 0 ? "contained" : "outlined"}
                onClick={() => { setFormState(0); setError(""); }}
              >
                Sign In
              </Button>
              <Button
                fullWidth
                variant={formState === 1 ? "contained" : "outlined"}
                onClick={() => { setFormState(1); setError(""); }}
              >
                Sign Up
              </Button>
            </Box>

            <Box component="form" onSubmit={handleAuth} noValidate sx={{ mt: 1, width: '100%' }}>
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
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 4, mb: 2, py: 1.5 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : (formState === 0 ? "Sign In" : "Register")}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
      <Snackbar open={open} autoHideDuration={4000} onClose={() => setOpen(false)}>
        <Alert onClose={() => setOpen(false)} severity="success" sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
