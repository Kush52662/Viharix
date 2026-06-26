import { createTheme } from "@mui/material/styles";

export const tokens = {
  shadow: {
    card: "rgba(0, 0, 0, 0.04) 0px 4px 12px",
    float: "rgba(0, 0, 0, 0.08) 0px 8px 24px",
    overlay: "rgba(0, 0, 0, 0.12) 0px 12px 32px",
  },
  radius: {
    card: 14,
    dialog: 20,
    pill: 9999,
    nav: 28,
  },
};

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
      fontSize: "2rem", // display
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1.2,
      color: "#222222",
    },
    h2: {
      fontSize: "1.5rem", // pageTitle
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1.3,
      color: "#222222",
    },
    h3: {
      fontSize: "1.15rem", // sectionTitle
      fontWeight: 600,
      letterSpacing: "-0.01em",
      lineHeight: 1.4,
      color: "#222222",
    },
    h4: {
      fontSize: "0.95rem", // cardTitle
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#222222",
    },
    h5: {
      fontSize: "0.95rem", // fallback cardTitle
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#222222",
    },
    h6: {
      fontSize: "0.875rem", // sub cardTitle / bodyBold
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#222222",
    },
    subtitle1: {
      fontSize: "0.875rem", // bodySemiBold
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#222222",
    },
    subtitle2: {
      fontSize: "0.75rem", // captionSemiBold
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#6A6A6A",
    },
    body1: {
      fontSize: "0.875rem", // body
      fontWeight: 400,
      lineHeight: 1.5,
      color: "#222222",
    },
    body2: {
      fontSize: "0.875rem", // bodyMuted (aligned size to 0.875rem as requested for cohesive layout)
      fontWeight: 400,
      lineHeight: 1.5,
      color: "#6A6A6A",
    },
    caption: {
      fontSize: "0.75rem", // caption
      fontWeight: 500,
      lineHeight: 1.4,
      color: "#6A6A6A",
    },
    overline: {
      fontSize: "0.65rem", // microLabel
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      lineHeight: 1.4,
      color: "#6A6A6A",
    },
    button: {
      fontSize: "0.875rem", // button
      textTransform: "none", // Avoid all-caps
      fontWeight: 600,
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: tokens.radius.card, // Airbnb medium rounding (14px)
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
          borderRadius: tokens.radius.card,
          boxShadow: tokens.shadow.card,
          border: "1px solid #EBEBEB",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: tokens.radius.dialog,
          boxShadow: tokens.shadow.overlay,
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
