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
    <Box sx={{ width: "100%" }}>
      <Paper
        sx={{
          borderRadius: 3,
          background: "#6366F1",
          color: "#FFFFFF",
          p: 3,
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
          Cost Estimation Software
        </Typography>
        <Typography variant="body1" sx={{ color: "#C7D2FE", mt: 0.5 }}>
          Manage and track your cost estimation projects
        </Typography>
      </Paper>

      <Box sx={{ mb: 3, display: "flex", justifyContent: "flex-start" }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onChange("create_project")}
          sx={{
            bgcolor: "#6366F1",
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.85rem",
            borderRadius: 2,
            "&:hover": { bgcolor: "#4F46E5" },
          }}
        >
          Create New Project
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
        <Box
          sx={{
            px: 3,
            py: 2,
            background: "#6366F1",
            color: "#FFFFFF",
            borderBottom: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ color: "#FFFFFF" }}>
            Existing Projects
          </Typography>
          <Typography variant="caption" sx={{ color: "#C7D2FE" }}>
            Manage and track your cost estimation projects
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
                projects.map((p) => (
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
