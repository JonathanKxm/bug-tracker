import { Box, Stack, Typography, Tabs, Tab, Paper, Table, TableBody, TableRow, TableCell, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert } from "@mui/material";
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

interface AdminData {
  users: any[];
  projects: any[];
  tags: any[];
  audit: any[];
}

export default function AdminPage() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<AdminData>({ users: [], projects: [], tags: [], audit: [] });
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const reload = async () => {
    try {
      const [users, projects, audit] = await Promise.all([
        apiGet<{ items: any[] }>("/api/users"),
        apiGet<{ items: any[] }>("/api/projects?includeArchived=1"),
        apiGet<{ items: any[] }>("/api/audit"),
      ]);
      setData({ users: users.items, projects: projects.items, tags: data.tags, audit: audit.items });
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  return (
    <Box>
      <Typography variant="h5">管理员面板</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`项目 (${data.projects.length})`} />
        <Tab label={`用户 (${data.users.length})`} />
        <Tab label={`审计 (${data.audit.length})`} />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {tab === 0 && (
        <Paper>
          <Stack direction="row" justifyContent="flex-end" sx={{ p: 1 }}>
            <Button variant="contained" onClick={() => setCreateOpen(true)}>新建项目</Button>
          </Stack>
          <Table>
            <TableBody>
              {data.projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><strong>{p.key}</strong></TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.description ?? "—"}</TableCell>
                  <TableCell><Chip size="small" label={p.archived ? "已归档" : "活跃"} color={p.archived ? "default" : "success"} /></TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => apiPatch(`/api/projects/${p.id}`, { archived: p.archived ? 0 : 1 }).then(reload)}>
                      {p.archived ? "取消归档" : "归档"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>用户列表</Typography>
          <Table>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name ?? "—"}</TableCell>
                  <TableCell>
                    <TextField select size="small" value={u.role} onChange={async (e) => {
                      await apiPatch(`/api/users/${u.id}`, { role: e.target.value });
                      reload();
                    }}>
                      <MenuItem value="admin">admin</MenuItem>
                      <MenuItem value="tester">tester</MenuItem>
                      <MenuItem value="dev">dev</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={async () => {
                      const email = prompt("输入要加入此用户到项目 ID 的邮箱:");
                      if (!email) return;
                      const projectId = prompt("项目 ID:") ?? "1";
                      try { await apiPost(`/api/projects/${projectId}/members`, { email }); reload(); } catch (e: any) { alert(e.message); }
                    }}>加入项目</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 2 && (
        <Paper>
          <Table>
            <TableBody>
              {data.audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.actor_email}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>{a.target_type}/{a.target_id}</TableCell>
                  <TableCell sx={{ whiteSpace: "pre-wrap" }}>{a.details ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { reload(); setCreateOpen(false); }} />
    </Box>
  );
}

function CreateProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await apiPost("/api/projects", { name, key: key.toUpperCase(), description });
      onCreated();
      setName(""); setKey(""); setDescription("");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>新建项目</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Stack gap={2} sx={{ mt: 1 }}>
          <TextField label="项目名称" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="KEY (大写 2-10 位)" value={key} onChange={(e) => setKey(e.target.value)} fullWidth />
          <TextField label="描述" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !name || !key}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
