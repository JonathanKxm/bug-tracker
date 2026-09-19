import { Box, AppBar, Toolbar, Typography, IconButton, Drawer, Badge, Avatar, Menu, MenuItem, Divider, useMediaQuery, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import HomeIcon from "@mui/icons-material/Home";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/useNotifications";
import NotificationCenter from "@/components/NotificationCenter";

const drawerWidth = 240;

export default function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const notif = useNotifications();

  const navItems = [
    { to: "/projects", label: "项目", icon: <HomeIcon /> },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "管理员", icon: <AdminPanelSettingsIcon /> }] : []),
  ];

  const drawer = (
    <Box sx={{ width: drawerWidth }} onClick={() => setMobileOpen(false)}>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>🐞 Bug Tracker</Typography>
      </Toolbar>
      <Divider />
      <List>
        {navItems.map((it) => (
          <ListItem key={it.to} disablePadding>
            <ListItemButton component={Link} to={it.to} selected={loc.pathname.startsWith(it.to)}>
              <ListItemIcon>{it.icon}</ListItemIcon>
              <ListItemText primary={it.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen((v) => !v)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>{pageTitle(loc.pathname)}</Typography>
          <IconButton onClick={() => setNotifOpen(true)} aria-label="notifications">
            <Badge badgeContent={notif.unread} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={(e) => setProfileAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14 }}>
              {(user?.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu open={!!profileAnchor} anchorEl={profileAnchor} onClose={() => setProfileAnchor(null)}>
            <MenuItem disabled>{user?.email}</MenuItem>
            <MenuItem disabled>角色: {user?.role}</MenuItem>
            <Divider />
            <MenuItem onClick={() => { setProfileAnchor(null); nav("/projects"); }}>项目</MenuItem>
            {user?.role === "admin" && <MenuItem onClick={() => { setProfileAnchor(null); nav("/admin"); }}>管理员</MenuItem>}
            <Divider />
            <MenuItem component="a" href="/cdn-cgi/access/logout">退出</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {!isMobile ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box", borderRight: "1px solid #e0e0e0" },
          }}
          open
        >
          {drawer}
        </Drawer>
      ) : (
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }}>
          {drawer}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 1.5, md: 3 }, mt: 8, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        {children}
      </Box>

      <Drawer anchor="right" open={notifOpen} onClose={() => setNotifOpen(false)}>
        <NotificationCenter onClose={() => setNotifOpen(false)} onRefresh={notif.refresh} />
      </Drawer>
    </Box>
  );
}

function pageTitle(path: string): string {
  if (path.startsWith("/projects") && path.includes("/bugs/")) return "Bug 详情";
  if (path.startsWith("/projects")) return "项目工作台";
  if (path.startsWith("/admin")) return "管理员";
  return "Bug Tracker";
}
