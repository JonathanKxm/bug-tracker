import { Box, Stack, Typography, Button, TextField, MenuItem, Chip, Card, CardActionArea, CardContent, useMediaQuery, Pagination, Checkbox, FormControlLabel, Drawer, IconButton, Tooltip, Alert } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { apiGet, apiPost } from "@/lib/api";
import { STATUS_LABEL, STATUS_COLOR, SEVERITY_LABEL, SEVERITY_COLOR, ALL_STATUSES, ALL_SEVERITIES } from "@/constants";
import { useAuth } from "@/lib/auth";
import type { Bug, Paginated, Project, Tag } from "@/types";

export default function ProjectWorkspace() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { user } = useAuth();
  const nav = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [project, setProject] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [data, setData] = useState<Paginated<Bug> | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(isMobile ? 10 : 20);
  const [sort, setSort] = useState("-updated_at");

  const [createOpen, setCreateOpen] = useState(false);

  const reload = () => {
    apiGet<Paginated<Bug>>("/api/bugs", {
      project: pid,
      q: query,
      status: status || undefined,
      severity: severity || undefined,
      tag: tagIds,
      includeDeleted: includeDeleted && user?.role === "admin" ? 1 : undefined,
      sort,
      page,
      pageSize,
    }).then(setData).catch(() => undefined);
  };

  useEffect(() => {
    apiGet<{ project: Project }>(`/api/projects/${pid}`).then((d) => setProject(d.project)).catch(() => undefined);
    apiGet<{ items: Tag[] }>(`/api/tags?project=${pid}`).then((d) => setTags(d.items)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [pid, page, sort, pageSize, status, severity, includeDeleted]);
  useEffect(() => {
    const t = setTimeout(reload, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [query, tagIds.join(",")]);

  const totalPages = useMemo(() => data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1, [data]);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" sx={{ mb: 2, gap: 1 }}>
        <Box>
          <Typography variant="h5">{project?.name ?? "加载中…"}</Typography>
          <Typography variant="overline" color="primary">{project?.key}</Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>提 Bug</Button>
      </Stack>

      <Stack direction="row" gap={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="搜索标题 / 描述…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          sx={{ minWidth: { xs: 200, sm: 280 } }}
        />
        <TextField select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={{ minWidth: 120 }} label="状态">
          <MenuItem value="">全部状态</MenuItem>
          {ALL_STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
        </TextField>
        <TextField select size="small" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} sx={{ minWidth: 120 }} label="严重度">
          <MenuItem value="">全部</MenuItem>
          {ALL_SEVERITIES.map((s) => <MenuItem key={s} value={s}>{SEVERITY_LABEL[s]}</MenuItem>)}
        </TextField>
        <Tooltip title="筛选"><IconButton onClick={() => setFilterOpen(true)}><FilterListIcon /></IconButton></Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <TextField select size="small" value={sort} onChange={(e) => setSort(e.target.value)} label="排序">
          <MenuItem value="-updated_at">最近更新</MenuItem>
          <MenuItem value="-created_at">最近创建</MenuItem>
          <MenuItem value="-severity">严重度 ↓</MenuItem>
          <MenuItem value="severity">严重度 ↑</MenuItem>
          <MenuItem value="-bug_number">编号 ↓</MenuItem>
          <MenuItem value="bug_number">编号 ↑</MenuItem>
        </TextField>
      </Stack>

      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {/* Mobile card list */}
        <Stack gap={1}>
          {data?.items?.map((b) => <BugCardMobile key={b.id} bug={b} projectKey={project?.key ?? ""} onClick={() => nav(`/projects/${pid}/bugs/${b.id}`)} />)}
          {!data?.items?.length && <Alert severity="info">没有匹配的 Bug</Alert>}
        </Stack>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Stack gap={1}>
          {data?.items?.map((b) => <BugCardDesktop key={b.id} bug={b} projectKey={project?.key ?? ""} onClick={() => nav(`/projects/${pid}/bugs/${b.id}`)} />)}
          {!data?.items?.length && <Alert severity="info">没有匹配的 Bug</Alert>}
        </Stack>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
        <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
      </Box>

      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Box sx={{ width: 280, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>标签筛选</Typography>
          {tags.length === 0 ? <Typography color="text.secondary">暂无标签</Typography> :
            <Stack>
              {tags.map((t) => (
                <FormControlLabel
                  key={t.id}
                  control={<Checkbox checked={tagIds.includes(t.id)} onChange={() => { setTagIds((s) => s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]); setPage(1); }} />}
                  label={<Chip size="small" label={t.name} sx={{ bgcolor: t.color ?? undefined, color: "white" }} />}
                />
              ))}
            </Stack>
          }
          {user?.role === "admin" && (
            <FormControlLabel
              control={<Checkbox checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />}
              label="显示已删除"
              sx={{ mt: 2 }}
            />
          )}
        </Box>
      </Drawer>

      <CreateBugDialog open={createOpen} onClose={() => setCreateOpen(false)} projectId={pid} onCreated={(id) => { setCreateOpen(false); nav(`/projects/${pid}/bugs/${id}`); reload(); }} />
    </Box>
  );
}

function BugCardDesktop({ bug, projectKey, onClick }: { bug: Bug; projectKey: string; onClick: () => void }) {
  return (
    <Card sx={{ opacity: bug.deleted_at ? 0.5 : 1 }}>
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="overline" color="primary">{projectKey}-{bug.bug_number}</Typography>
            <Chip size="small" label={STATUS_LABEL[bug.status]} sx={{ bgcolor: STATUS_COLOR[bug.status], color: "white" }} />
            <Chip size="small" label={SEVERITY_LABEL[bug.severity]} sx={{ bgcolor: SEVERITY_COLOR[bug.severity], color: "white" }} />
            {bug.tags?.map((t) => <Chip key={t.id} size="small" label={t.name} sx={{ bgcolor: t.color ?? undefined, color: "white" }} />)}
          </Stack>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{bug.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {bug.description}
          </Typography>
          <Stack direction="row" gap={2} sx={{ mt: 1, color: "text.secondary", fontSize: 12 }}>
            <span>提单: {bug.reporter_name || bug.reporter_email}</span>
            <span>分配: {bug.assignee_name || bug.assignee_email || "未分配"}</span>
            <span>更新: {formatDistanceToNow(bug.updated_at, { addSuffix: true, locale: zhCN })}</span>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function BugCardMobile({ bug, projectKey, onClick }: { bug: Bug; projectKey: string; onClick: () => void }) {
  return (
    <Card onClick={onClick} sx={{ opacity: bug.deleted_at ? 0.5 : 1 }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap">
          <Typography variant="overline" color="primary">{projectKey}-{bug.bug_number}</Typography>
          <Chip size="small" label={STATUS_LABEL[bug.status]} sx={{ bgcolor: STATUS_COLOR[bug.status], color: "white" }} />
        </Stack>
        <Typography variant="body1" sx={{ fontWeight: 500 }}>{bug.title}</Typography>
        <Typography variant="caption" color="text.secondary">{formatDistanceToNow(bug.updated_at, { addSuffix: true, locale: zhCN })}</Typography>
      </CardContent>
    </Card>
  );
}

function CreateBugDialog({ open, onClose, projectId, onCreated }: { open: boolean; onClose: () => void; projectId: number; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<any>("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const data = await apiPost<{ id: number; bug_number: number }>(`/api/bugs`, { project_id: projectId, title, description, severity });
      onCreated(data.id);
      setTitle(""); setDescription(""); setSeverity("medium");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 480 } } }} ModalProps={{ keepMounted: true }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>提 Bug</Typography>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Stack gap={2}>
          <TextField label="标题" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <TextField label="描述" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={6} />
          <TextField select label="严重度" value={severity} onChange={(e) => setSeverity(e.target.value)} fullWidth>
            {ALL_SEVERITIES.map((s) => <MenuItem key={s} value={s}>{SEVERITY_LABEL[s]}</MenuItem>)}
          </TextField>
          <Button variant="contained" disabled={busy || !title || !description} onClick={submit}>提交</Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
