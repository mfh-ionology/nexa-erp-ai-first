import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import type { TextInputProps as RNTextInputProps } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function TextInput({
  label,
  error,
  helperText,
  ...props
}: TextInputProps) {
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        style={[styles.input, hasError && styles.inputError]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        accessibilityState={{ disabled: props.editable === false }}
        {...props}
      />
      {hasError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.caption,
    color: colors.text,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.statusError,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: typography.lineHeights.small,
    color: colors.statusError,
  },
  helperText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.small,
    lineHeight: typography.lineHeights.small,
    color: colors.textMuted,
  },
});
