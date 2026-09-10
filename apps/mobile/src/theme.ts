import { StyleSheet } from "react-native";

export const colors = {
  bg: "#f4f7fb",
  card: "#ffffff",
  ink: "#0f2744",
  muted: "#5b6b7c",
  line: "#d7e0ea",
  accent: "#1d6fb8",
  accentSoft: "#e8f2fb",
  danger: "#b42318",
  success: "#0f7a45",
  tab: "#0f2744",
};

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpi: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
  empty: {
    textAlign: "center",
    color: colors.muted,
    marginTop: 24,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: colors.accent,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.accent,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  headerMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
});
