import { Box, Card, CardActionArea, CardContent, Typography, Chip, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPost } from "@/lib/api";
import type { Project } from "@/types";

export default function ProjectsPage() {
  const { user, refresh } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    apiGet<{ items: Project[] }>("/api/projects").then((d) => setProjects(d.items)).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{user?.role === "admin" ? "所有项目" : "我的项目"}</Typography>
          <Typography color="text.secondary">{user?.email}</Typography>
        </Box>
        {user?.role === "admin" && (
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
            新建项目
          </Button>
        )}
      </Stack>

      {!loading && projects.length === 0 && (
        <Alert severity={user?.role === "admin" ? "info" : "warning"}>
          {user?.role === "admin"
            ? "还没有项目。点击右上角创建一个吧。"
            : "您尚未被分配到任何项目,请联系管理员加入。"}
        </Alert>
      )}

      <Stack direction="row" gap={2} flexWrap="wrap">
        {projects.map((p) => (
          <Card key={p.id} sx={{ width: { xs: "100%", sm: 280 }, flexShrink: 0 }}>
            <CardActionArea component={Link} to={`/projects/${p.id}`}>
              <CardContent>
                <Typography variant="overline" color="primary">{p.key}</Typography>
                <Typography variant="h6">{p.name}</Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }} noWrap>
                  {p.description || "—"}
                </Typography>
                <Chip size="small" label={p.archived ? "已归档" : "活跃"} color={p.archived ? "default" : "success"} />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => {
        setCreateOpen(false);
        apiGet<{ items: Project[] }>("/api/projects").then((d) => setProjects(d.items));
        refresh();
      }} />
    </Box>
  );
}

function CreateProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiPost("/api/projects", { name, key: key.toUpperCase(), description });
      onCreated();
      setName(""); setKey(""); setDescription("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>新建项目</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack gap={2}>
          <TextField label="项目名称" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="KEY (大写字母数字 2-10 位)" value={key} onChange={(e) => setKey(e.target.value)} fullWidth inputProps={{ pattern: "[A-Za-z][A-Za-z0-9]{1,9}" }} />
          <TextField label="描述 (可选)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !name || !key}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
