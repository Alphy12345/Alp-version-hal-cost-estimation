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
  InputAdornment,
  IconButton,
  Divider,
  Fade,
  Slide,
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at top, rgba(56,189,248,0.15) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Animated background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'pulse 8s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
            '50%': { transform: 'scale(1.2)', opacity: 0.8 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'pulse 10s ease-in-out infinite reverse',
        }}
      />

      <Slide direction="up" in={true} timeout={600}>
        <Box sx={{ maxWidth: 480, width: '100%', mx: 2, position: 'relative', zIndex: 1 }}>
          {/* Logo/Brand Section */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 2,
                background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 40px rgba(56,189,248,0.3)',
              }}
            >
              <BusinessIcon sx={{ fontSize: 40, color: '#fff' }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.5px',
                textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              Cost Estimation
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.6)',
                mt: 1,
              }}
            >
              Professional Manufacturing Cost Management
            </Typography>
          </Box>

          {/* Main Card */}
          <Paper
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              border: '1px solid rgba(56,189,248,0.2)',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 3,
                pb: 2,
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                borderBottom: '1px solid rgba(56,189,248,0.3)',
              }}
            >
              <Typography
                variant="h5"
                align="center"
                sx={{
                  fontWeight: 700,
                  color: '#fff',
                  mb: 1,
                }}
              >
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </Typography>
              <Typography
                variant="body2"
                align="center"
                sx={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {isLogin
                  ? 'Sign in to access your cost estimation dashboard'
                  : 'Register to start managing your manufacturing costs'}
              </Typography>
            </Box>

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
              <Fade in={true} timeout={400}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
                        placeholder="Enter your username"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon sx={{ color: '#38bdf8' }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(15,23,42,0.8)',
                            color: '#fff',
                            '& fieldset': {
                              borderColor: 'rgba(56,189,248,0.3)',
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(15,23,42,0.9)',
                              '& fieldset': {
                                borderColor: 'rgba(56,189,248,0.5)',
                              },
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'rgba(15,23,42,1)',
                              '& fieldset': {
                                borderColor: '#38bdf8',
                              },
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255,255,255,0.7)',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#38bdf8',
                          },
                        }}
                      />
                      <TextField
                        id="password"
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        fullWidth
                        value={formData.password}
                        onChange={handleInputChange}
                        variant="outlined"
                        placeholder="Enter your password"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon sx={{ color: '#38bdf8' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={togglePasswordVisibility}
                                edge="end"
                                sx={{ color: 'rgba(255,255,255,0.7)' }}
                              >
                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(15,23,42,0.8)',
                            color: '#fff',
                            '& fieldset': {
                              borderColor: 'rgba(56,189,248,0.3)',
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(15,23,42,0.9)',
                              '& fieldset': {
                                borderColor: 'rgba(56,189,248,0.5)',
                              },
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'rgba(15,23,42,1)',
                              '& fieldset': {
                                borderColor: '#38bdf8',
                              },
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255,255,255,0.7)',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#38bdf8',
                          },
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <TextField
                        id="fullName"
                        name="fullName"
                        label="Full Name"
                        type="text"
                        required
                        fullWidth
                        value={formData.fullName}
                        onChange={handleInputChange}
                        variant="outlined"
                        placeholder="Enter your full name"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <BadgeIcon sx={{ color: '#38bdf8' }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(15,23,42,0.8)',
                            color: '#fff',
                            '& fieldset': {
                              borderColor: 'rgba(56,189,248,0.3)',
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(15,23,42,0.9)',
                              '& fieldset': {
                                borderColor: 'rgba(56,189,248,0.5)',
                              },
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'rgba(15,23,42,1)',
                              '& fieldset': {
                                borderColor: '#38bdf8',
                              },
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255,255,255,0.7)',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#38bdf8',
                          },
                        }}
                      />
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
                        placeholder="Choose a username"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon sx={{ color: '#38bdf8' }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(15,23,42,0.8)',
                            color: '#fff',
                            '& fieldset': {
                              borderColor: 'rgba(56,189,248,0.3)',
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(15,23,42,0.9)',
                              '& fieldset': {
                                borderColor: 'rgba(56,189,248,0.5)',
                              },
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'rgba(15,23,42,1)',
                              '& fieldset': {
                                borderColor: '#38bdf8',
                              },
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255,255,255,0.7)',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#38bdf8',
                          },
                        }}
                      />
                      <TextField
                        id="email"
                        name="email"
                        label="Email Address"
                        type="email"
                        required
                        fullWidth
                        value={formData.email}
                        onChange={handleInputChange}
                        variant="outlined"
                        placeholder="Enter your email"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailIcon sx={{ color: '#38bdf8' }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(15,23,42,0.8)',
                            color: '#fff',
                            '& fieldset': {
                              borderColor: 'rgba(56,189,248,0.3)',
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(15,23,42,0.9)',
                              '& fieldset': {
                                borderColor: 'rgba(56,189,248,0.5)',
                              },
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'rgba(15,23,42,1)',
                              '& fieldset': {
                                borderColor: '#38bdf8',
                              },
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255,255,255,0.7)',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#38bdf8',
                          },
                        }}
                      />
                      <TextField
                        id="password"
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        fullWidth
                        value={formData.password}
                        onChange={handleInputChange}
                        variant="outlined"
                        placeholder="Create a password"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockIcon sx={{ color: '#38bdf8' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={togglePasswordVisibility}
                                edge="end"
                                sx={{ color: 'rgba(255,255,255,0.7)' }}
                              >
                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'rgba(15,23,42,0.8)',
                            color: '#fff',
                            '& fieldset': {
                              borderColor: 'rgba(56,189,248,0.3)',
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(15,23,42,0.9)',
                              '& fieldset': {
                                borderColor: 'rgba(56,189,248,0.5)',
                              },
                            },
                            '&.Mui-focused': {
                              backgroundColor: 'rgba(15,23,42,1)',
                              '& fieldset': {
                                borderColor: '#38bdf8',
                              },
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255,255,255,0.7)',
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#38bdf8',
                          },
                        }}
                      />
                    </>
                  )}
                </Box>
              </Fade>

              {/* Error Alert */}
              {error && (
                <Fade in={true}>
                  <Alert
                    severity="error"
                    sx={{
                      mt: 2,
                      borderRadius: 2,
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                    }}
                  >
                    {error}
                  </Alert>
                </Fade>
              )}

              {/* Success Alert */}
              {success && (
                <Fade in={true}>
                  <Alert
                    severity="success"
                    sx={{
                      mt: 2,
                      borderRadius: 2,
                      backgroundColor: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}
                  >
                    {success}
                  </Alert>
                </Fade>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
                startIcon={isLogin ? <LoginIcon /> : <PersonAddIcon />}
                sx={{
                  mt: 3,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  background: isLoading
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
                  boxShadow: '0 4px 14px rgba(56,189,248,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    boxShadow: '0 6px 20px rgba(56,189,248,0.5)',
                  },
                  '&:disabled': {
                    background: '#94a3b8',
                  },
                }}
              >
                {isLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} sx={{ color: '#fff' }} />
                    Processing...
                  </Box>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </Button>

              {/* Divider */}
              <Divider sx={{ my: 3, '&::before, &::after': { borderColor: 'rgba(56,189,248,0.2)' } }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', px: 1 }}>
                  or
                </Typography>
              </Divider>

              {/* Toggle Mode Link */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                </Typography>
                <Button
                  onClick={toggleMode}
                  sx={{
                    mt: 0.5,
                    color: '#38bdf8',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: 'rgba(56,189,248,0.1)',
                    },
                  }}
                >
                  {isLogin ? 'Create a new account' : 'Sign in to your account'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Footer */}
          <Typography
            variant="body2"
            align="center"
            sx={{
              mt: 4,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            © 2026 Cost Estimation System. All rights reserved.
          </Typography>
        </Box>
      </Slide>
    </Box>
  );
};

export default LoginPage;
