import { Box, Button, Typography } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 2,
        p: 2,
        textAlign: "center",
      }}
    >
      <BugReportIcon sx={{ fontSize: 80, color: "primary.main" }} />
      <Typography variant="h4">Bug Tracker</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        请通过企业邮箱登录。第一个登录的用户自动成为管理员。
      </Typography>
      <Button
        variant="contained"
        size="large"
        component="a"
        href="/cdn-cgi/access/login"
        sx={{ mt: 2 }}
      >
        企业邮箱登录
      </Button>
    </Box>
  );
}
