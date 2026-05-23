import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { AITypingSkeleton } from '../../components/SkeletonLoader';
import { BASE_URL } from '../../utils/config';
import { ROUTES } from '../../navigation/routes';
import { RootStackScreenProps } from '../../navigation/types';
import { Screen } from '../../components/common/Screen';
import Header from '../../components/common/Header';
import { colors } from '../../theme/colors';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
};

type Props = RootStackScreenProps<typeof ROUTES.AI_CHAT>;

export default function AIChatScreen({ route, navigation }: Props) {
  const trendContext = route.params?.trendContext;
  const trendTitle = trendContext?.title;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: trendTitle
        ? `Hello! I see you're exploring the trend:\n"${trendTitle}"\n\nWhat would you like to know about it?`
        : "Hello! I am Shahkal AI, your advanced trend intelligence assistant. Ask me anything!",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Map last 10 messages for context (prevents token limit overflow)
      const history = messages.slice(-10).map(m => ({
        role: m.sender === 'ai' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const response = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          trendContext: trendContext || undefined,
          history: history
        })
      });

      const json = await response.json();

      if (json.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: json.data.reply,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(json.message);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting to my servers. Please try again later.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAI = item.sender === 'ai';
    return (
      <View style={[styles.messageWrapper, isAI ? styles.messageWrapperAI : styles.messageWrapperUser]}>
        {isAI && (
          <LinearGradient colors={[colors.neon.cyan, '#4FACFE']} style={styles.avatar}>
            <Feather name="cpu" size={14} color={colors.background.primary} />
          </LinearGradient>
        )}

        <LinearGradient
          colors={isAI ? ["rgba(30,27,46,0.8)", "rgba(20,15,30,0.9)"] : ["rgba(0, 242, 254, 0.15)", "rgba(0, 242, 254, 0.05)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.messageBubble, isAI ? styles.messageBubbleAI : styles.messageBubbleUser]}
        >
          <Text style={styles.messageText}>{item.text}</Text>
        </LinearGradient>

        {!isAI && (
          <View style={[styles.avatar, { backgroundColor: colors.neon.purple, marginLeft: 10 }]}>
            <Feather name="user" size={14} color="#FFF" />
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen scrollable={false} safeAreaEdges={['top']} keyboardAvoiding={true}>
      <View style={styles.ambientGlow} />

      <Header title="AI Assistant" showBack={true} onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {isLoading && <AITypingSkeleton />}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask me about AI trends..."
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity onPress={sendMessage} disabled={isLoading || !inputText.trim()}>
            <LinearGradient
              colors={inputText.trim() ? [colors.neon.cyan, '#4FACFE'] : ["#1e1b2e", "#2a2440"]}
              style={styles.sendButton}
            >
              <Feather name="send" size={20} color={inputText.trim() ? colors.background.primary : "#64748B"} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 242, 254, 0.05)',
    transform: [{ scale: 2 }],
  },
  chatContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  messageWrapperAI: {
    justifyContent: 'flex-start',
    paddingRight: 50,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
    paddingLeft: 50,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  messageBubble: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  messageBubbleAI: {
    borderBottomLeftRadius: 4,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  messageBubbleUser: {
    borderBottomRightRadius: 4,
    borderColor: 'rgba(0, 242, 254, 0.3)',
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 20,
    backgroundColor: 'rgba(10,5,20,0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#1e1b2e',
    borderRadius: 24,
    minHeight: 50,
    maxHeight: 120,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    color: '#F8FAFC',
    fontSize: 15,
    paddingTop: 14,
    paddingBottom: 14,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  }
});
