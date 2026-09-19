import { Box, Stack, Typography, Chip, Card, CardContent, Divider, Button, TextField, MenuItem, Select, Avatar, Tabs, Tab, Paper, Accordion, AccordionSummary, AccordionDetails, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import SubscribeIcon from "@mui/icons-material/NotificationsActive";
import SubscribedIcon from "@mui/icons-material/NotificationsActive";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, STATUS_COLOR, SEVERITY_LABEL, SEVERITY_COLOR, ALL_STATUSES, ALL_SEVERITIES } from "@/constants";
import type { Bug, Project, Tag } from "@/types";
import { canTransition } from "@/lib/stateClient";
import ImageUploader from "@/components/ImageUploader";

interface BugDetail {
  bug: Bug;
  reporter: { id: number; name: string | null; email: string } | null;
  assignee: { id: number; name: string | null; email: string } | null;
  comments: any[];
  history: any[];
  tags: Tag[];
  attachments: any[];
}

export default function BugDetailPage() {
  const { projectId, bugId } = useParams();
  const pid = Number(projectId);
  const bid = Number(bugId);
  const { user } = useAuth();

  const [data, setData] = useState<BugDetail | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState(0);
  const [comment, setComment] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [audit, setAudit] = useState<any[]>([]);

  const reload = async () => {
    const [det, pj] = await Promise.all([
      apiGet<BugDetail>(`/api/bugs/${bid}`),
      apiGet<{ project: Project; members?: any[] }>(`/api/projects/${pid}`),
    ]);
    setData(det);
    setProject(pj.project);
    setMembers(pj.members ?? []);
  };

  useEffect(() => {
    reload();
    if (user?.role === "admin") apiGet("/api/audit", { target_type: "bug", target_id: bid }).then((d: any) => setAudit(d.items ?? []));
    // eslint-disable-next-line
  }, [bid]);

  if (!data) return <Box>加载中…</Box>;

  const updateBug = async (patch: any) => {
    try {
      await apiPatch(`/api/bugs/${bid}`, patch);
      await reload();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    try {
      await apiPost(`/api/bugs/${bid}/comments`, { content: comment });
      setComment("");
      reload();
    } catch (e: any) { alert(e.message); }
  };

  const toggleSubscribe = async () => {
    if (subscribed) {
      await fetch(`/api/bugs/${bid}/subscribe`, { method: "DELETE", credentials: "same-origin" });
      setSubscribed(false);
    } else {
      await apiPost(`/api/bugs/${bid}/subscribe`, {});
      setSubscribed(true);
    }
  };

  const setBugStatus = async (newStatus: any) => {
    await updateBug({ status: newStatus });
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h5">{project?.key}-{data.bug.bug_number}</Typography>
        <Chip label={STATUS_LABEL[data.bug.status]} sx={{ bgcolor: STATUS_COLOR[data.bug.status], color: "white" }} />
        <Chip label={SEVERITY_LABEL[data.bug.severity]} sx={{ bgcolor: SEVERITY_COLOR[data.bug.severity], color: "white" }} />
        {data.tags.map((t) => <Chip key={t.id} label={t.name} size="small" sx={{ bgcolor: t.color ?? undefined, color: "white" }} />)}
        {data.bug.deleted_at && <Chip label="已删除" color="default" size="small" />}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={toggleSubscribe}>
          {subscribed ? <SubscribedIcon color="primary" /> : <SubscribeIcon />}
        </IconButton>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="详情" />
        <Tab label={`讨论 (${data.comments.length})`} />
        <Tab label={`流转 (${data.history.length})`} />
        {user?.role === "admin" && <Tab label={`审计 (${audit.length})`} />}
      </Tabs>

      {tab === 0 && (
        <Box>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">{data.bug.title}</Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", mt: 1 }}>{data.bug.description}</Typography>
              <Divider sx={{ my: 2 }} />
              <Stack direction={{ xs: "column", md: "row" }} gap={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline">状态</Typography>
                  <Select fullWidth size="small" value={data.bug.status} onChange={(e) => setBugStatus(e.target.value)}>
                    {ALL_STATUSES.filter((s) => canTransition(data.bug.status, s)).map((s) => (
                      <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>
                    ))}
                    <MenuItem value={data.bug.status} disabled>{STATUS_LABEL[data.bug.status]} (当前)</MenuItem>
                  </Select>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline">严重度</Typography>
                  <Select fullWidth size="small" value={data.bug.severity} onChange={(e) => updateBug({ severity: e.target.value })} disabled={user?.role !== "admin"}>
                    {ALL_SEVERITIES.map((s) => <MenuItem key={s} value={s}>{SEVERITY_LABEL[s]}</MenuItem>)}
                  </Select>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline">指派给</Typography>
                  <Select fullWidth size="small" value={data.bug.assignee_id ?? ""} onChange={(e) => updateBug({ assignee_id: e.target.value || null })}>
                    <MenuItem value="">未分配</MenuItem>
                    {members.map((m) => <MenuItem key={m.id} value={m.id}>{m.name || m.email}</MenuItem>)}
                  </Select>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <ImageUploader bugId={bid} />
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack gap={2}>
            {data.comments.map((c) => (
              <Stack key={c.id} direction="row" gap={2}>
                <Avatar>{(c.author_name ?? c.author_email ?? "?")[0].toUpperCase()}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{c.author_name || c.author_email} · {formatDistanceToNow(c.created_at, { addSuffix: true, locale: zhCN })}</Typography>
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>{c.content}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" gap={1} sx={{ mt: 3 }}>
            <TextField fullWidth multiline rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写一条评论…" />
            <Button variant="contained" onClick={submitComment} disabled={!comment.trim()}>发送</Button>
          </Stack>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>状态流转图</Typography>
            <SankeyChart bugId={bid} />
          </Paper>
          <Stack gap={1}>
            {data.history.map((h) => (
              <Stack key={h.id} direction="row" gap={2} sx={{ p: 1 }}>
                <HistoryIcon color="action" />
                <Box>
                  <Typography variant="body2">
                    <strong>{h.changed_by_name}</strong> 在 {formatDistanceToNow(h.changed_at, { addSuffix: true, locale: zhCN })} ·
                    {h.from_status ? ` ${STATUS_LABEL[h.from_status as keyof typeof STATUS_LABEL]} → ` : " "}
                    <Chip size="small" label={STATUS_LABEL[h.to_status as keyof typeof STATUS_LABEL]} sx={{ bgcolor: STATUS_COLOR[h.to_status as keyof typeof STATUS_COLOR], color: "white" }} />
                  </Typography>
                  {h.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{h.note}</Typography>}
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {tab === 3 && user?.role === "admin" && (
        <Stack>
          {audit.map((a) => (
            <Accordion key={a.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">
                  <strong>{a.actor_name || a.actor_email}</strong> · {a.action} · {formatDistanceToNow(a.created_at, { addSuffix: true, locale: zhCN })}
                </Typography>
              </AccordionSummary>
              <AccordionDetails><pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{a.details || "—"}</pre></AccordionDetails>
            </Accordion>
          ))}
          {audit.length === 0 && <Typography color="text.secondary">暂无审计记录</Typography>}
        </Stack>
      )}
    </Box>
  );
}

function SankeyChart({ bugId }: { bugId: number }) {
  const [opt, setOpt] = useState<any>(null);
  useEffect(() => {
    apiGet(`/api/bugs/${bugId}/history`).then((d: any) => {
      const data = d.nodes.map((n: any) => ({ name: n.name }));
      const links = d.links.map((l: any) => ({ source: l.source, target: l.target, value: l.value }));
      setOpt({
        tooltip: { trigger: "item" },
        series: [{
          type: "sankey",
          data,
          links,
          emphasis: { focus: "adjacency" },
          lineStyle: { color: "gradient", curveness: 0.5 },
          label: { formatter: (p: any) => STATUS_LABEL[p.name as keyof typeof STATUS_LABEL] ?? p.name },
        }],
      });
    });
  }, [bugId]);
  if (!opt) return <Typography>加载中…</Typography>;
  return <ReactECharts option={opt} style={{ height: 280 }} />;
}
