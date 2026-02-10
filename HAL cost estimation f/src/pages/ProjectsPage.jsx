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
  Grid,
  Card,
  CardContent,
  CardActions,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";

function ProjectsPage({ onChange }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      <Paper
        sx={{
          borderRadius: 3,
          background: "#000000",
          color: "white",
          p: 3,
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={600} sx={{ letterSpacing: 0.5 }}>
          Cost Estimation Software
        </Typography>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3, height: "100%", bgcolor: "#000000" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": {
                      transform: "scale(1.05)",
                      boxShadow: 3,
                    },
                  }}
                  onClick={() => onChange("create_project")}
                  role="button"
                  aria-label="Create New Project"
                >
                  <AddIcon sx={{ color: "white", fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Create New Project
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start a new cost estimation project
                  </Typography>
                </Box>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                Initialize a new project with parts, drawings, and specifications for comprehensive cost analysis and estimation.
                Upload technical documents and manage project details efficiently.
              </Typography>

              <Button
                onClick={() => onChange("create_project")}
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 600 }}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#000000" }}>
        <Box
          sx={{
            px: 3,
            py: 2,
            background: "#000000",
            color: "white",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Existing Projects
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Manage and track your cost estimation projects
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#000000" }}>
                <TableCell sx={{ fontWeight: 700, color: "#d4af37", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  Project Name
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#d4af37", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  Customer Name
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#d4af37", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  Created Date
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#d4af37", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  Number of Parts
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#d4af37", textTransform: "uppercase", fontSize: "0.75rem" }}>
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
                projects.map((p) => (
                  <TableRow 
                    key={p.id} 
                    hover
                    sx={{
                      bgcolor: "#000000",
                      "& td": { color: "white", borderBottom: "1px solid rgba(255,255,255,0.1)" }
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            bgcolor: "success.main",
                            mt: 0.75,
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={600} sx={{ color: "white" }}>
                            {p.project_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                            ID: {p.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ color: "white" }}>
                        {p.customer_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                        Customer
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ color: "white" }}>
                        {formatDate(p.created_at)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                        Creation Date
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${p.parts?.length || 0} Parts`}
                        size="small"
                        sx={{ 
                          fontWeight: 600, 
                          fontSize: "0.7rem",
                          color: "white",
                          borderColor: "rgba(255,255,255,0.5)"
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
                            background: "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.75rem",
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
                            fontSize: "0.75rem",
                            color: "#fbbf24",
                            borderColor: "#fbbf24",
                            "&:hover": { borderColor: "#f59e0b", bgcolor: "rgba(251,191,36,0.1)" }
                          }}
                          startIcon={<EditIcon sx={{ color: "#fbbf24" }} />}
                          onClick={() => onChange("edit_project", { projectId: p.id })}
                        >
                          Edit
                        </Button>
                        <IconButton
                          size="small"
                          sx={{ color: "#ef4444" }}
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
          <Typography variant="caption" color="text.secondary">
            Showing {projects.length} projects
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined">
              Previous
            </Button>
            <Button size="small" variant="outlined">
              Next
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default ProjectsPage;
