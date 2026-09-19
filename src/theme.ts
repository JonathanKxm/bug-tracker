import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    secondary: { main: "#7b1fa2" },
    success: { main: "#388e3c" },
    warning: { main: "#f57c00" },
    error: { main: "#d32f2f" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: [
      'Noto Sans SC',
      '"Helvetica Neue"',
      "Helvetica",
      '"PingFang SC"',
      '"Microsoft YaHei"',
      "Arial",
      "sans-serif",
    ].join(","),
    h6: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h3: { fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: "1px solid #e0e0e0" } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
