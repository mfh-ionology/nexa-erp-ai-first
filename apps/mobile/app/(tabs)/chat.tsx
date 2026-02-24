/**
 * Chat tab — AI-first mobile experience.
 *
 * Placeholder UI for the primary AI chat interface.
 * - Text input at bottom with send button
 * - Message list area with empty state + suggested prompts
 * - Static placeholder messages for visual structure
 * - Fully wired to WebSocket AI chat in later epic (E9+)
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTranslation } from '@nexa/i18n';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'chat.suggestOverdue',
  'chat.suggestCashflow',
  'chat.suggestApprovals',
] as const;

export default function ChatScreen() {
  const { t } = useTranslation('mobile');
  const [message, setMessage] = useState('');
  const [messages] = useState<ChatMessage[]>([]);

  const handleSend = () => {
    if (!message.trim()) return;
    // Placeholder — will be wired to WebSocket in a later epic
    setMessage('');
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText,
          ]}
        >
          {item.content}
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <MaterialCommunityIcons
        name="robot-outline"
        size={64}
        color={colors.primaryLight}
      />
      <Text style={styles.emptyStateTitle}>{t('chat.emptyState')}</Text>
      <View style={styles.suggestedPrompts}>
        {SUGGESTED_PROMPTS.map((key) => (
            <Pressable
              key={key}
              style={styles.promptChip}
              onPress={() => setMessage(t(key))}
              accessibilityRole="button"
            >
              <Text style={styles.promptChipText}>{t(key)}</Text>
            </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          messages.length === 0 ? styles.emptyList : styles.messageList
        }
        ListEmptyComponent={renderEmptyState}
        inverted={messages.length > 0}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          returnKeyType="default"
          accessibilityLabel={t('chat.inputPlaceholder')}
        />
        <Pressable
          style={[
            styles.sendButton,
            !message.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!message.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
        >
          <MaterialCommunityIcons
            name="send"
            size={22}
            color={message.trim() ? colors.surface : colors.textMuted}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.subheading,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  suggestedPrompts: {
    width: '100%',
    gap: spacing.sm,
  },
  promptChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  promptChipText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  userMessageText: {
    color: colors.surface,
  },
  assistantMessageText: {
    color: colors.text,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.body,
    color: colors.text,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
