import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  fontFamily,
  sizes: {
    heading: 24,
    subheading: 18,
    body: 16,
    caption: 14,
    small: 12,
  },
  lineHeights: {
    heading: 32,
    subheading: 26,
    body: 24,
    caption: 20,
    small: 16,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;
