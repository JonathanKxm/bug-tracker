import { Box, List, ListItemButton, ListItemText, Typography, Chip, IconButton, Divider } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import DoneAllIcon from "@mui/icons-material/DoneAll";

interface Props {
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function NotificationCenter({ onClose, onRefresh }: Props) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: any) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const goToBug = (n: any) => {
    if (n.bug_id) {
      nav(`/projects/${n.bug_id}/bugs/${n.bug_id}`);
      onClose();
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await onRefresh();
    setItems((arr: any[]) => arr.map((n: any) => ({ ...n, read_at: Date.now() })));
  };

  return (
    <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6">通知</Typography>
        <IconButton size="small" onClick={markAllRead} aria-label="mark all read">
          <DoneAllIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 1 }} />
      {loading ? (
        <Typography color="text.secondary">加载中…</Typography>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">暂无通知</Typography>
      ) : (
        <List dense>
          {items.map((n) => (
            <ListItemButton
              key={n.id}
              onClick={() => goToBug(n)}
              sx={{
                bgcolor: n.read_at ? "transparent" : "action.hover",
                borderRadius: 1,
                mb: 0.5,
              }}
            >
              <Box sx={{ width: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {!n.read_at && <Chip label="新" size="small" color="error" />}
                  <ListItemText primary={n.title} />
                </Box>
                {n.body && <Typography variant="body2" color="text.secondary" noWrap>{n.body}</Typography>}
                <Typography variant="caption" color="text.secondary">
                  {formatDistanceToNow(n.created_at, { addSuffix: true, locale: zhCN })}
                </Typography>
              </Box>
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
