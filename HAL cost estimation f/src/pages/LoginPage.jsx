import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login, register } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const result = await login(formData.username, formData.password);
        if (result.success) {
          setSuccess('Login successful! Redirecting...');
          // Redirect will be handled by App component
        } else {
          setError(result.error);
        }
      } else {
        const result = await register(
          formData.username,
          formData.email,
          formData.password,
          formData.fullName
        );
        if (result.success) {
          setSuccess('Registration successful! You can now login.');
          // Switch to login form after successful registration
          setTimeout(() => {
            setIsLogin(true);
            setFormData({
              username: formData.username,
              email: '',
              fullName: '',
              password: '',
            });
          }, 2000);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setFormData({
      username: '',
      email: '',
      fullName: '',
      password: '',
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: "url('./assets/vecteezy_ai-generated-innovative-atomic-futuristic-atomic-nuclear_36748390.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        py: { xs: 6, sm: 12 },
        px: { xs: 2, sm: 3, lg: 4 },
      }}
    >
      <Box sx={{ maxWidth: 448, width: '100%' }}>
        <Paper elevation={3} sx={{ borderRadius: 2, p: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" align="center" fontWeight="bold" gutterBottom>
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary">
              {isLogin ? 'Or' : 'Already have an account?'}{' '}
              <Link
                component="button"
                type="button"
                onClick={toggleMode}
                sx={{ fontWeight: 500, cursor: 'pointer' }}
              >
                {isLogin ? 'create a new account' : 'sign in to your account'}
              </Link>
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {isLogin ? (
                <>
                  <TextField
                    id="username"
                    name="username"
                    label="Username"
                    type="text"
                    required
                    fullWidth
                    value={formData.username}
                    onChange={handleInputChange}
                    variant="outlined"
                  />
                  <TextField
                    id="password"
                    name="password"
                    label="Password"
                    type="password"
                    required
                    fullWidth
                    value={formData.password}
                    onChange={handleInputChange}
                    variant="outlined"
                  />
                </>
              ) : (
                <>
                  <TextField
                    id="username"
                    name="username"
                    label="Username"
                    type="text"
                    required
                    fullWidth
                    value={formData.username}
                    onChange={handleInputChange}
                    variant="outlined"
                  />
                  <TextField
                    id="email"
                    name="email"
                    label="Email address"
                    type="email"
                    required
                    fullWidth
                    value={formData.email}
                    onChange={handleInputChange}
                    variant="outlined"
                  />
                  <TextField
                    id="fullName"
                    name="fullName"
                    label="Full name"
                    type="text"
                    required
                    fullWidth
                    value={formData.fullName}
                    onChange={handleInputChange}
                    variant="outlined"
                  />
                  <TextField
                    id="password"
                    name="password"
                    label="Password"
                    type="password"
                    required
                    fullWidth
                    value={formData.password}
                    onChange={handleInputChange}
                    variant="outlined"
                  />
                </>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert
                severity="info"
                sx={{
                  mt: 2,
                  border: "1px solid rgba(56,189,248,0.25)",
                  bgcolor: "rgba(56,189,248,0.08)",
                  color: "text.primary",
                }}
              >
                {success}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{ mt: 3, py: 1.5 }}
            >
              {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} color="inherit" />
                  Processing...
                </Box>
              ) : (
                <span>{isLogin ? 'Sign in' : 'Create account'}</span>
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default LoginPage;
