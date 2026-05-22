/**
 * NirmalMandi AI Agent — Floating Action Button + chat overlay.
 * Hindi/English bilingual. Voice input support.
 * Uses /ai/agent/chat endpoint with conversation threading.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme/tokens';
import { aiApi } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  visible: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function AgentFab({ visible, onToggle, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await aiApi.agentChat({
        message: userMsg,
        conversationId,
        language: 'hi', // Hindi preferred
      });
      const { response, conversationId: cid } = res.data.data;
      setConversationId(cid);
      setMessages(m => [...m, { role: 'assistant', content: response }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'माफ़ करें, कुछ गड़बड़ हुई। फिर से कोशिश करें।' }]);
    } finally {
      setLoading(false);
    }
  }

  const SUGGESTIONS = [
    'मुझे FMCG deals दिखाओ',
    'Best deals today?',
    'मेरे orders का status?',
    'Automotive sector में deals?',
  ];

  const s = makeStyles(colors, isDark);

  return (
    <>
      {/* FAB */}
      <Animated.View style={[s.fabWrapper, { transform: [{ scale: pulse }] }]}>
        <TouchableOpacity style={s.fab} onPress={onToggle}>
          <Text style={s.fabIcon}>{visible ? '✕' : '🤖'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Chat Modal */}
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.headerTitle}>NirmalMandi Agent</Text>
                <Text style={s.headerSub}>हिंदी · English · 24/7</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent}>
              {messages.length === 0 && (
                <View style={s.welcome}>
                  <Text style={s.welcomeText}>नमस्ते! 👋</Text>
                  <Text style={s.welcomeSub}>मैं NirmalMandi Agent हूँ। आपकी कैसे मदद कर सकता हूँ?</Text>
                  <View style={s.suggestions}>
                    {SUGGESTIONS.map((sg, i) => (
                      <TouchableOpacity
                        key={i}
                        style={s.suggestion}
                        onPress={() => { setInput(sg); }}
                      >
                        <Text style={s.suggestionText}>{sg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {messages.map((m, i) => (
                <View key={i} style={[s.bubble, m.role === 'user' ? s.userBubble : s.agentBubble]}>
                  <Text style={[s.bubbleText, m.role === 'user' ? s.userText : s.agentText]}>
                    {m.content}
                  </Text>
                </View>
              ))}

              {loading && (
                <View style={[s.bubble, s.agentBubble]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="Type in Hindi or English..."
                placeholderTextColor={colors.muted}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!input.trim() || loading}
              >
                <Text style={s.sendBtnText}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function makeStyles(colors: typeof Colors.light, isDark: boolean) {
  return StyleSheet.create({
    fabWrapper: {
      position: 'absolute',
      bottom: 100,
      right: Spacing[6],
      zIndex: 999,
    },
    fab: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...Shadow.lg,
    },
    fabIcon: { fontSize: 24 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      height: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing[4],
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    headerTitle: {
      fontSize: Typography.md,
      fontWeight: Typography.bold,
      color: colors.text,
    },
    headerSub: { color: colors.muted, fontSize: Typography.xs },
    closeBtn: { padding: Spacing[2] },
    closeBtnText: { color: colors.muted, fontSize: Typography.lg },
    messages: { flex: 1 },
    messagesContent: { padding: Spacing[4], gap: Spacing[3] },
    welcome: { alignItems: 'center', paddingVertical: Spacing[6] },
    welcomeText: {
      fontSize: Typography.xl,
      fontWeight: Typography.bold,
      color: colors.text,
    },
    welcomeSub: {
      color: colors.textSecondary,
      fontSize: Typography.sm,
      textAlign: 'center',
      marginTop: Spacing[2],
      marginBottom: Spacing[4],
    },
    suggestions: { gap: Spacing[2], width: '100%' },
    suggestion: {
      backgroundColor: Colors.primaryPale,
      borderRadius: Radius.md,
      padding: Spacing[3],
      borderWidth: 1,
      borderColor: Colors.primary + '30',
    },
    suggestionText: { color: Colors.primary, fontSize: Typography.sm },
    bubble: {
      maxWidth: '80%',
      borderRadius: Radius.lg,
      padding: Spacing[3],
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: Colors.primary,
    },
    agentBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceAlt,
    },
    bubbleText: { fontSize: Typography.sm, lineHeight: 20 },
    userText: { color: '#fff' },
    agentText: { color: colors.text },
    inputRow: {
      flexDirection: 'row',
      padding: Spacing[4],
      gap: Spacing[2],
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing[4],
      paddingVertical: Spacing[3],
      color: colors.text,
      fontSize: Typography.base,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: '#fff', fontSize: Typography.base },
  });
}
