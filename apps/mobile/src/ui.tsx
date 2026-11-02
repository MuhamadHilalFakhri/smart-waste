import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
export const colors = {
  ink: "#172d27",
  muted: "#53665e",
  green: "#185b42",
  paper: "#f6f6ef",
  line: "#d9e1d7",
  error: "#9d2929",
};
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.green }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 120, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[s.notice, error && { backgroundColor: "#fff1ee" }]}
    >
      <Text style={[s.body, error && { color: colors.error }]}>{text}</Text>
    </View>
  );
}
export function Loading() {
  return (
    <ActivityIndicator
      size="large"
      color={colors.green}
      accessibilityLabel="Memuat data"
      style={{ padding: 35 }}
    />
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 20, paddingBottom: 48, gap: 16 },
  wordmark: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.green,
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.8,
  },
  heading: { fontSize: 19, fontWeight: "700", color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  panel: {
    padding: 18,
    backgroundColor: "white",
    borderRadius: 12,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  button: {
    backgroundColor: colors.green,
    paddingVertical: 13,
    paddingHorizontal: 17,
    minHeight: 48,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: "white",
    borderColor: "#b3c7b9",
    borderWidth: 1,
  },
  buttonText: { fontWeight: "700", color: "white", fontSize: 14 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: "#aabbb0",
    borderRadius: 6,
    padding: 12,
    minHeight: 48,
    backgroundColor: "white",
    fontSize: 16,
    color: colors.ink,
  },
  notice: { padding: 15, borderRadius: 7, backgroundColor: "#e8efe3" },
  nav: {
    padding: 12,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8,
  },
  navItem: { padding: 12, minHeight: 44, borderRadius: 6 },
  navText: { color: colors.muted, fontWeight: "600" },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    backgroundColor: colors.paper,
  },
  status: {
    backgroundColor: "#e8efe3",
    color: colors.green,
    padding: 7,
    borderRadius: 5,
    alignSelf: "flex-start",
    fontWeight: "700",
    fontSize: 12,
  },
  stat: {
    minWidth: "44%",
    flexGrow: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 17,
    gap: 8,
  },
  number: { fontSize: 30, fontWeight: "800", color: colors.green },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: "white",
  },
  selectedChip: { backgroundColor: colors.green, borderColor: colors.green },
});
