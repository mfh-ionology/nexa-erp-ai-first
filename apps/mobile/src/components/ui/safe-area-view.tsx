import { StyleSheet } from 'react-native';
import {
  SafeAreaView as RNSafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import type { ViewProps } from 'react-native';

import { colors } from '@/theme/colors';

interface SafeAreaViewProps extends ViewProps {
  children: React.ReactNode;
  edges?: Edge[];
  backgroundColor?: string;
}

export function SafeAreaView({
  children,
  edges = ['top', 'bottom'],
  backgroundColor = colors.background,
  style,
  ...props
}: SafeAreaViewProps) {
  return (
    <RNSafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor }, style]}
      {...props}
    >
      {children}
    </RNSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
