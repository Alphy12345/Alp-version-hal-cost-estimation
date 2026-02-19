import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import './index.css'
import App from './App.jsx'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e3a5f' },
    secondary: { main: '#d4af37' },
    success: { main: '#22c55e' },
    background: {
      default: '#e3f2fd',
      paper: '#ffffff',
    },
    text: { primary: '#1e293b', secondary: '#64748b' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: [
      'Inter',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(30,58,95,0.25)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(148,163,184,0.2)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(148,163,184,0.2)',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          letterSpacing: 0.2,
          borderBottom: '1px solid rgba(148,163,184,0.25)',
          backgroundColor: '#f1f5f9',
          color: '#1e3a5f',
        },
        body: {
          borderBottom: '1px solid rgba(148,163,184,0.15)',
          color: '#334155',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          '&:hover': {
            backgroundColor: 'rgba(30,58,95,0.04)',
          },
        },
      },
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
