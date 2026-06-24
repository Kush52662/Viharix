import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#FF385C", // Airbnb Rausch
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#008489", // Airbnb Teal (secondary accent)
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FFFFFF", // Airbnb Canvas White
      paper: "#FFFFFF",
    },
    text: {
      primary: "#222222", // Ink
      secondary: "#6A6A6A", // Muted
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: "1.6rem",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "#222222",
    },
    h2: {
      fontSize: "1.35rem",
      fontWeight: 700,
      letterSpacing: "-0.015em",
      color: "#222222",
    },
    h3: {
      fontSize: "1.15rem",
      fontWeight: 600,
      color: "#222222",
    },
    h4: {
      fontSize: "1.05rem",
      fontWeight: 600,
      color: "#222222",
    },
    h5: {
      fontSize: "0.95rem",
      fontWeight: 600,
      color: "#222222",
    },
    h6: {
      fontSize: "0.875rem",
      fontWeight: 600,
      color: "#222222",
    },
    subtitle1: {
      fontSize: "0.85rem",
      fontWeight: 600,
      color: "#222222",
    },
    subtitle2: {
      fontSize: "0.78rem",
      fontWeight: 500,
      color: "#6A6A6A",
    },
    body1: {
      fontSize: "0.82rem",
      color: "#222222",
    },
    body2: {
      fontSize: "0.75rem",
      color: "#6A6A6A",
    },
    button: {
      fontSize: "0.78rem",
      textTransform: "none", // Avoid all-caps
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 14, // Airbnb medium rounding (14px)
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Airbnb standard button rounding (8px)
          padding: "10px 20px",
          boxShadow: "none",
          fontWeight: 600,
          "&:hover": {
            boxShadow: "none",
          },
          "&.MuiButton-containedPrimary": {
            backgroundColor: "#FF385C",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: "#E00B41", // Rausch active
            },
          },
          "&.MuiButton-containedSecondary": {
            backgroundColor: "#008489",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: "#006F73", // Slightly darker teal
            },
          },
          "&.MuiButton-outlinedPrimary": {
            borderColor: "#FF385C",
            color: "#FF385C",
            "&:hover": {
              backgroundColor: "rgba(255, 56, 92, 0.04)",
              borderColor: "#E00B41",
            },
          },
          "&.MuiButton-outlinedSecondary": {
            borderColor: "#008489",
            color: "#008489",
            "&:hover": {
              backgroundColor: "rgba(0, 132, 137, 0.04)",
              borderColor: "#006F73",
            },
          },
          "&.MuiButton-textPrimary": {
            color: "#FF385C",
            "&:hover": {
              backgroundColor: "rgba(255, 56, 92, 0.04)",
            },
          },
          "&.MuiButton-textSecondary": {
            color: "#008489",
            "&:hover": {
              backgroundColor: "rgba(0, 132, 137, 0.04)",
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: "rgba(0, 0, 0, 0.04) 0px 4px 12px", // Airbnb light card shadow
          border: "1px solid #EBEBEB",
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #EBEBEB",
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: "#6A6A6A",
          "&.Mui-selected": {
            color: "#FF385C",
          },
        },
      },
    },
  },
});
export default theme;
