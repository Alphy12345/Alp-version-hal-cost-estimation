import React, { useMemo, useState, useEffect } from "react";
import { getProjects, deleteProject } from "../api/projects";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Stack,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from "@mui/icons-material";

function ProjectsPage({ onChange }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const projectsPerPage = 5;

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch projects");
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        await deleteProject(projectId);
        setProjects(projects.filter(p => p.id !== projectId));
      } catch (err) {
        console.error("Error deleting project:", err);
        alert("Failed to delete project");
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const activeCount = useMemo(
    () => projects.filter((p) => String(p.status || "").toLowerCase().includes("active")).length,
    [projects]
  );

  // Pagination logic
  const totalPages = Math.ceil(projects.length / projectsPerPage);
  const currentProjects = projects.slice((page - 1) * projectsPerPage, page * projectsPerPage);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: "100%" }}>
      {/* Professional Software Header - Full Width */}
      <Paper
        sx={{
          borderRadius: 0,
          background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%)",
          color: "#FFFFFF",
          px: 4,
          py: 2.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          borderBottom: "4px solid #d4af37",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Box
            component="img"
            src="/assets/download (2).jpg"
            alt="HAL Logo"
            sx={{
              height: 60,
              objectFit: "contain",
              borderRadius: 1,
              bgcolor: "#FFFFFF",
              p: 0.5,
            }}
          />
          <Box>
            <Typography 
              variant="h4" 
              fontWeight={800} 
              sx={{ 
                letterSpacing: 1, 
                fontSize: "1.8rem",
                color: "#d4af37",
                textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              Manufacturing Cost Estimation Software
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Create New Project Button - Below Header Right Side */}
      <Box sx={{ mb: 3, px: 4, pt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onChange("create_project")}
          sx={{
            bgcolor: "#2563eb",
            color: "#ffffff",
            textTransform: "none",
            fontWeight: 700,
            fontSize: "1rem",
            px: 4,
            py: 1.2,
            borderRadius: 2,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            "&:hover": { 
              bgcolor: "#1d4ed8",
              transform: "translateY(-2px)",
              boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            },
            transition: "all 0.2s ease",
          }}
        >
          Create New Project
        </Button>
      </Box>

      {/* Existing Projects Section - Clean heading without background */}
      <Paper sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "#E2E8F0" }}>
          <Typography variant="h5" fontWeight={800} sx={{ color: "#0F172A", fontSize: "1.4rem" }}>
            Existing Projects
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#6366F1", "& > *": { bgcolor: "#6366F1 !important" } }}>
                <TableCell sx={{ fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", fontSize: "0.85rem", bgcolor: "#6366F1" }}>
                  Project Name
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", fontSize: "0.85rem", bgcolor: "#6366F1" }}>
                  Customer Name
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", fontSize: "0.85rem", bgcolor: "#6366F1" }}>
                  Created Date
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", fontSize: "0.85rem", bgcolor: "#6366F1" }}>
                  Number of Parts
                </TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", fontSize: "0.85rem", bgcolor: "#6366F1" }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading projects...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Alert severity="error">{error}</Alert>
                  </TableCell>
                </TableRow>
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No projects found. Create your first project to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                currentProjects.map((p) => (
                  <TableRow 
                    key={p.id} 
                    hover
                    sx={{
                      bgcolor: "#FFFFFF",
                      "&:hover": { bgcolor: "#F8FAFC" },
                      "& td": { color: "#0F172A", borderBottom: "1px solid #E2E8F0", fontSize: "0.95rem" }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: "#10B981",
                            mt: 0.75,
                          }}
                        />
                        <Box>
                          <Typography variant="body1" fontWeight={700} sx={{ color: "#0F172A" }}>
                            {p.project_name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#94A3B8" }}>
                            ID: {p.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" fontWeight={600} sx={{ color: "#0F172A" }}>
                        {p.customer_name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#94A3B8" }}>
                        Customer
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" fontWeight={600} sx={{ color: "#0F172A" }}>
                        {formatDate(p.created_at)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#94A3B8" }}>
                        Creation Date
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${p.parts?.length || 0} Parts`}
                        size="small"
                        sx={{ 
                          fontWeight: 700, 
                          fontSize: "0.85rem",
                          bgcolor: "#EEF2FF",
                          color: "#4338CA",
                          borderColor: "#C7D2FE",
                          border: "1px solid #C7D2FE",
                        }}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<VisibilityIcon />}
                          onClick={() => onChange("project_detail", { projectId: p.id })}
                          sx={{
                            bgcolor: "#6366F1",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            "&:hover": { bgcolor: "#4F46E5" },
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ 
                            textTransform: "none", 
                            fontWeight: 600, 
                            fontSize: "0.85rem",
                            bgcolor: "#F1F5F9",
                            borderColor: "#CBD5E1",
                            color: "#334155",
                            "&:hover": { borderColor: "#CBD5E1", bgcolor: "#E2E8F0" }
                          }}
                          startIcon={<EditIcon sx={{ color: "#6366F1" }} />}
                          onClick={() => onChange("edit_project", { projectId: p.id })}
                        >
                          Edit
                        </Button>
                        <IconButton
                          size="small"
                          sx={{
                            bgcolor: "#FEF2F2",
                            color: "#EF4444",
                            "&:hover": { bgcolor: "#FEE2E2" },
                          }}
                          onClick={() => handleDeleteProject(p.id)}
                          title="Delete Project"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Footer */}
        {projects.length > 0 && (
          <Box
            sx={{
              px: 3,
              py: 2,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Showing {Math.min((page - 1) * projectsPerPage + 1, projects.length)} - {Math.min(page * projectsPerPage, projects.length)} of {projects.length} projects
            </Typography>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={handlePageChange}
              color="primary"
              size="small"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default ProjectsPage;
