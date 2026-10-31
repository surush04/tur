import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mediaUrl } from './config';
import { useI18n } from './i18n';
import { colors } from './theme';

export function Frame({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );
  return <SafeAreaView style={styles.safe}>{body}</SafeAreaView>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({ label, onPress, disabled, ghost }: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, ghost ? styles.ghost : styles.primary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, ghost && styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  keyboard,
  maxLength,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  keyboard?: KeyboardTypeOptions;
  maxLength?: number;
  multiline?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const { t } = useI18n();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !shown}
          keyboardType={keyboard}
          maxLength={maxLength}
          multiline={multiline}
          autoCapitalize="none"
          style={[styles.input, multiline && styles.area]}
          placeholderTextColor={colors.muted}
        />
        {secure ? (
          <Pressable onPress={() => setShown((item) => !item)} hitSlop={8} accessibilityLabel={t(shown ? 'auth.hide' : 'auth.show')}>
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Photo({ url, height = 96 }: { url?: string | null; height?: number }) {
  const src = mediaUrl(url);
  if (!src) return <View style={[styles.photo, { height }]} />;
  return <Image source={{ uri: src }} style={[styles.photo, { height }]} />;
}

export function Card({ title, subtitle, image, onPress }: { title: string; subtitle?: string; image?: string | null; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Photo url={image} height={72} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.muted} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Notice({ text, error }: { text: string; error?: boolean }) {
  return <Text style={[styles.notice, error && styles.error]}>{text}</Text>;
}

export function Loading() {
  return <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />;
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, padding: 16 },
  page: { padding: 16, gap: 12, paddingBottom: 36 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: colors.primary },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghostText: { color: colors.text },
  field: { gap: 6 },
  label: { color: colors.text, fontWeight: '700', fontSize: 13 },
  inputRow: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10 },
  area: { minHeight: 88, textAlignVertical: 'top' },
  photo: { width: 84, borderRadius: 16, backgroundColor: '#E8F1FF' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  notice: { color: colors.secondary, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 10 },
  error: { color: colors.danger, backgroundColor: '#FEF2F2' },
  chip: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#E8F1FF', borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.primary },
});
