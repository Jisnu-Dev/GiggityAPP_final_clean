import { StyleSheet, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable, View, ScrollView, Animated, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: number;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

// New type for the global memory context
type MemoryContext = {
  userName?: string;
  userInterests?: string[];
  importantDates?: { description: string; date: string }[];
  preferences?: { [key: string]: any };
  facts?: { [key: string]: any };
  lastUpdated: number;
};

export default function ChatBotScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  // Global memory context for the chatbot
  const [memoryContext, setMemoryContext] = useState<MemoryContext>({
    lastUpdated: Date.now()
  });
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const arrowAnimation = useRef(new Animated.Value(0)).current;
  const API_KEY = 'AIzaSyDomf7gcJ5OFYVNzl2nRRfmbDe6exqqcps';
  
  // Get the active chat
  const activeChat = chats.find(chat => chat.id === activeChatId) || null;
  
  useEffect(() => {
    loadChats();
    loadMemoryContext(); // Load the memory context when component mounts
  }, []);

  useEffect(() => {
    saveChats();
    if (activeChat && activeChat.messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chats]);

  // Save memory context whenever it changes
  useEffect(() => {
    saveMemoryContext();
  }, [memoryContext]);

  useEffect(() => {
    // Animate the drawer when showChatList changes
    Animated.timing(drawerAnimation, {
      toValue: showChatList ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showChatList]);

  useEffect(() => {
    // Start the arrow animation when there's no active chat
    if (!activeChat) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(arrowAnimation, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      // Stop the animation when a chat is active
      arrowAnimation.setValue(0);
    }
  }, [activeChat]);

  // Debug memory context when modal opens
  useEffect(() => {
    if (showMemoryModal) {
      console.log('Current memory context in modal:', JSON.stringify(memoryContext));
    }
  }, [showMemoryModal, memoryContext]);

  const loadChats = async () => {
    try {
      const storedChats = await AsyncStorage.getItem('chats');
      if (storedChats) {
        const parsedChats = JSON.parse(storedChats);
        setChats(parsedChats);
        
        // Set the active chat to the most recent one
        if (parsedChats.length > 0) {
          setActiveChatId(parsedChats[0].id);
        } else {
          // Create a default chat if stored chats array is empty
          createNewChat();
        }
      } else {
        // Create a default chat if none exists
        createNewChat();
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      createNewChat();
    }
  };

  const saveChats = async () => {
    try {
      await AsyncStorage.setItem('chats', JSON.stringify(chats));
    } catch (error) {
      console.error('Failed to save chats:', error);
    }
  };

  const createNewChat = () => {
    const newId = Date.now().toString();
    const newChat = {
      id: newId,
      title: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now(),
    };
    
    // Using direct setState instead of callback to ensure immediate update
    setChats([newChat, ...chats]);
    setActiveChatId(newId);
    setShowChatList(false);
    
    // Return the new chat ID so it can be used immediately
    return newId;
  };

  const deleteChat = (chatId: string) => {
    setChats(prevChats => {
      const updatedChats = prevChats.filter(chat => chat.id !== chatId);
      
      // If the deleted chat was active, set a new active chat
      if (chatId === activeChatId && updatedChats.length > 0) {
        setActiveChatId(updatedChats[0].id);
      } else if (updatedChats.length === 0) {
        // If no chats remain, create a new one
        createNewChat();
      }
      
      return updatedChats;
    });
  };

  const clearCurrentChat = () => {
    if (!activeChatId) return;
    
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, messages: [] } 
          : chat
      )
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const updateChatTitle = (chatId: string, message: string) => {
    if (!chatId || message.length < 10) return;
    
    // Use the first few words of the first message as the chat title
    const words = message.split(' ');
    const title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
    
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId && chat.title.startsWith('Chat ') 
          ? { ...chat, title } 
          : chat
      )
    );
  };

  // This function handles clicking the New Chat button in the empty state
  const handleStartNewChat = () => {
    const newId = Date.now().toString();
    const newChat = {
      id: newId,
      title: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now(),
    };
    
    // Use a function form for state updates to ensure we have the latest state
    setChats(prevChats => [newChat, ...prevChats]);
    setActiveChatId(newId);
    setShowChatList(false);
  };

  // This is a NEW instant chat creation function that doesn't rely on React state updates
  const forceChatCreation = () => {
    // Create a new chat with a unique ID
    const timestamp = Date.now();
    const newId = timestamp.toString();
    
    // Create a new chat object
    const newChat = {
      id: newId,
      title: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: timestamp,
    };
    
    // Directly manipulate the chats array (not relying on state updates)
    const newChats = [newChat, ...chats];
    setChats(newChats);
    setActiveChatId(newId);
    
    // Return both the chat ID and the updated chats array
    return { id: newId, updatedChats: newChats };
  };

  // Replace with a simpler function that doesn't rely on state updates
  const handleSendButtonPress = () => {
    if (inputText.trim() === '') return;
    
    // Store the input text and clear the input immediately
    const textToSend = inputText;
    setInputText('');
    setIsLoading(true);
    
    // Force chat creation or get active chat ID
    let currentId: string;
    let currentChats: Chat[];
    
    if (!activeChatId) {
      try {
        // Force create a new chat and get the updated values
        const { id, updatedChats } = forceChatCreation();
        currentId = id;
        currentChats = updatedChats;
        
        // Double-check that the chat exists in our updated chats array
        if (!currentChats.find(c => c.id === currentId)) {
          console.log('Creating fallback chat as newly created chat was not found');
          // Try one more approach - add it directly to the array
          const newChat: Chat = {
            id: currentId,
            title: `Chat ${chats.length + 1}`,
            messages: [],
            createdAt: Date.now()
          };
          currentChats = [newChat, ...currentChats];
        }
      } catch (error) {
        console.log('Using fallback chat creation method');
        // Create a fallback chat as a last resort
        currentId = Date.now().toString();
        const fallbackChat: Chat = {
          id: currentId,
          title: `Chat ${chats.length + 1}`,
          messages: [],
          createdAt: Date.now()
        };
        currentChats = [fallbackChat, ...chats];
        setChats(currentChats);
        setActiveChatId(currentId);
      }
    } else {
      currentId = activeChatId;
      currentChats = [...chats]; // Make a copy of the current chats
    }
    
    // Create a user message
    const userMsg: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
      timestamp: Date.now(),
    };
    
    // Find the chat in our copy and add the message directly
    let chatToUpdate = currentChats.find(c => c.id === currentId);
    
    if (chatToUpdate) {
      // Check if it's the first message to update the title
      if (chatToUpdate.messages.length === 0 && textToSend.length >= 10) {
        const words = textToSend.split(' ');
        chatToUpdate.title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
      }
      
      // Add the message
      chatToUpdate.messages = [...chatToUpdate.messages, userMsg];
      
      // Update the state with our modified copy
      setChats([...currentChats]);
      
      // Call the API
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { 
                parts: [
                  { 
                    text: `
You are a friendly, conversational assistant named Giggity. Your goal is to be helpful, friendly, and to remember important details about the user.

MEMORY CONTEXT (important information about the user to remember):
${JSON.stringify(memoryContext, null, 2)}

CONVERSATION HISTORY:
${activeChat?.messages.map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n') || ''}

USER INPUT:
${textToSend}

INSTRUCTIONS:
1. Respond naturally to the user's message.
2. If you learn new information about the user, remember it in your memory.
3. IMPORTANT: Return your response in JSON format with two fields:
   - "response": Your friendly response to show the user
   - "memory_update": JSON object with any new information to add to memory context (or empty if nothing new)

Example:
{
  "response": "Nice to meet you, John! I'll remember that you like hiking.",
  "memory_update": {
    "userName": "John",
    "userInterests": ["hiking"]
  }
}
` 
                  }
                ]
              }
            ],
          }),
        }
      )
        .then(response => response.json())
        .then(data => {
          // Parse bot reply
          let botReply = 'Sorry, I couldn\'t process that.';
          let memoryUpdate = {};
          
          if (data.candidates && data.candidates[0]?.content?.parts && data.candidates[0].content.parts[0]?.text) {
            try {
              // Try to parse the JSON response
              const rawText = data.candidates[0].content.parts[0].text;
              console.log('API response raw text:', rawText.substring(0, 200) + '...');
              
              // Extract the JSON part from the text (in case model outputs extra text)
              const jsonMatch = rawText.match(/({[\s\S]*})/);
              
              if (jsonMatch) {
                console.log('JSON match found');
                try {
                  const parsedResponse = JSON.parse(jsonMatch[0]);
                  console.log('Successfully parsed JSON');
                  
                  if (parsedResponse.response) {
                    botReply = parsedResponse.response;
                    console.log('Bot reply set from response field');
                  }
                  
                  // Update memory context if any new information
                  if (parsedResponse.memory_update) {
                    console.log('Memory update found:', JSON.stringify(parsedResponse.memory_update));
                    if (Object.keys(parsedResponse.memory_update).length > 0) {
                      updateMemoryContext(parsedResponse.memory_update);
                      console.log('Memory context updated');
                    } else {
                      console.log('Memory update was empty object');
                    }
                  } else {
                    console.log('No memory_update field in parsed response');
                  }
                } catch (parseError) {
                  console.log('Error parsing JSON match:', parseError);
                  botReply = rawText;
                }
              } else {
                // If no JSON found, use the raw text as response
                console.log('No JSON match found in response');
                botReply = rawText;
              }
            } catch (error) {
              // If parsing fails, use the raw text
              botReply = data.candidates[0].content.parts[0].text;
              console.log('Failed to parse bot response as JSON:', error);
            }
          }
          
          // Create bot message
          const botMsg: Message = {
            id: Date.now().toString(),
            text: botReply, 
            sender: 'bot',
            timestamp: Date.now(),
          };
          
          // Get the current chats again using a fresh copy
          setChats(prevChats => {
            // Find the chat to update in the latest state
            const chatToAddBotMsg = prevChats.find(c => c.id === currentId);
            if (chatToAddBotMsg) {
              // Return a new array with the updated chat
              return prevChats.map(chat => 
                chat.id === currentId 
                  ? { ...chat, messages: [...chat.messages, botMsg] }
                  : chat
              );
            }
            // If chat doesn't exist anymore, just return current state
            return prevChats;
          });
        })
        .catch(error => {
          console.log('Handling API error gracefully');
          
          // Error message
          const errorMsg: Message = {
            id: Date.now().toString(),
            text: 'Sorry, there was an error connecting to the AI service.',
            sender: 'bot',
            timestamp: Date.now(),
          };
          
          // Add error message to chat using functional update pattern
          setChats(prevChats => {
            // Find the chat to update in the latest state
            const chatToAddErrorMsg = prevChats.find(c => c.id === currentId);
            if (chatToAddErrorMsg) {
              // Return a new array with the updated chat
              return prevChats.map(chat => 
                chat.id === currentId 
                  ? { ...chat, messages: [...chat.messages, errorMsg] }
                  : chat
              );
            }
            // If chat doesn't exist anymore, just return current state
            return prevChats;
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // Something went wrong - couldn't find the chat we just created or selected
      console.log('Creating fallback chat as no active chat was found');
      
      // Create a fallback chat and add the message to it
      const fallbackId = Date.now().toString();
      const fallbackChat: Chat = {
        id: fallbackId,
        title: textToSend.length >= 10 
          ? textToSend.split(' ').slice(0, 4).join(' ') + '...' 
          : `Chat ${chats.length + 1}`,
        messages: [userMsg],
        createdAt: Date.now()
      };
      
      // Update state with this emergency chat
      setChats([fallbackChat, ...chats]);
      setActiveChatId(fallbackId);
      setIsLoading(false);
      
      // Call API separately for this fallback chat
      setTimeout(() => {
        setIsLoading(true);
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { 
                  parts: [
                    { 
                      text: `
You are a friendly, conversational assistant named Giggity. Your goal is to be helpful, friendly, and to remember important details about the user.

MEMORY CONTEXT (important information about the user to remember):
${JSON.stringify(memoryContext, null, 2)}

CONVERSATION HISTORY:
${[userMsg].map(msg => `User: ${msg.text}`).join('\n')}

USER INPUT:
${textToSend}

INSTRUCTIONS:
1. Respond naturally to the user's message.
2. If you learn new information about the user, remember it in your memory.
3. IMPORTANT: Return your response in JSON format with two fields:
   - "response": Your friendly response to show the user
   - "memory_update": JSON object with any new information to add to memory context (or empty if nothing new)

Example:
{
  "response": "Nice to meet you, John! I'll remember that you like hiking.",
  "memory_update": {
    "userName": "John",
    "userInterests": ["hiking"]
  }
}
` 
                    }
                  ]
                }
              ],
            }),
          }
        )
          .then(response => response.json())
          .then(data => {
            let botReply = 'Sorry, I couldn\'t process that.';
            let memoryUpdate = {};
            
            if (data.candidates && data.candidates[0]?.content?.parts && data.candidates[0].content.parts[0]?.text) {
              try {
                // Try to parse the JSON response
                const rawText = data.candidates[0].content.parts[0].text;
                console.log('Fallback API response raw text:', rawText.substring(0, 200) + '...');
                
                // Extract the JSON part from the text (in case model outputs extra text)
                const jsonMatch = rawText.match(/({[\s\S]*})/);
                
                if (jsonMatch) {
                  console.log('JSON match found in fallback');
                  try {
                    const parsedResponse = JSON.parse(jsonMatch[0]);
                    console.log('Successfully parsed JSON in fallback');
                    
                    if (parsedResponse.response) {
                      botReply = parsedResponse.response;
                      console.log('Bot reply set from response field in fallback');
                    }
                    
                    // Update memory context if any new information
                    if (parsedResponse.memory_update) {
                      console.log('Memory update found in fallback:', JSON.stringify(parsedResponse.memory_update));
                      if (Object.keys(parsedResponse.memory_update).length > 0) {
                        updateMemoryContext(parsedResponse.memory_update);
                        console.log('Memory context updated from fallback');
                      } else {
                        console.log('Memory update was empty object in fallback');
                      }
                    } else {
                      console.log('No memory_update field in parsed fallback response');
                    }
                  } catch (parseError) {
                    console.log('Error parsing JSON match in fallback:', parseError);
                    botReply = rawText;
                  }
                } else {
                  // If no JSON found, use the raw text as response
                  console.log('No JSON match found in fallback response');
                  botReply = rawText;
                }
              } catch (error) {
                // If parsing fails, use the raw text
                botReply = data.candidates[0].content.parts[0].text;
                console.log('Failed to parse bot response as JSON in fallback call:', error);
              }
            }
            
            const botMsg: Message = {
              id: Date.now().toString(),
              text: botReply,
              sender: 'bot',
              timestamp: Date.now(),
            };
            
            setChats(prevChats => {
              const updatedChats = [...prevChats];
              const chatToUpdate = updatedChats.find(c => c.id === fallbackId);
              if (chatToUpdate) {
                chatToUpdate.messages = [...chatToUpdate.messages, botMsg];
                return updatedChats;
              }
              return prevChats;
            });
          })
          .catch(error => {
            console.log('Handling API error gracefully');
            
            const errorMsg: Message = {
              id: Date.now().toString(),
              text: 'Sorry, there was an error connecting to the AI service.',
              sender: 'bot',
              timestamp: Date.now(),
            };
            
            setChats(prevChats => {
              const updatedChats = [...prevChats];
              const chatToUpdate = updatedChats.find(c => c.id === fallbackId);
              if (chatToUpdate) {
                chatToUpdate.messages = [...chatToUpdate.messages, errorMsg];
                return updatedChats;
              }
              return prevChats;
            });
          })
          .finally(() => {
            setIsLoading(false);
          });
      }, 500);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageRow}>
      <View 
        style={[
          styles.messageContainer, 
          item.sender === 'user' ? styles.userMessage : styles.botMessage
        ]}
      >
        <ThemedText style={item.sender === 'user' ? styles.userMessageText : styles.botMessageText}>
          {item.text}
        </ThemedText>
        <ThemedText style={styles.timestamp}>
          {formatTime(item.timestamp)}
        </ThemedText>
      </View>
    </View>
  );

  const renderChatItem = (chat: Chat) => (
    <Pressable 
      key={chat.id}
      style={[
        styles.chatItem,
        chat.id === activeChatId && styles.activeChatItem
      ]}
      onPress={() => {
        setActiveChatId(chat.id);
        setShowChatList(false);
      }}
    >
      <View style={styles.chatItemContent}>
        <ThemedText style={styles.chatItemTitle} numberOfLines={1}>
          {chat.title}
        </ThemedText>
        <ThemedText style={styles.chatItemDate}>
          {formatDate(chat.createdAt)}
        </ThemedText>
      </View>
      <Pressable 
        style={styles.chatItemDelete}
        onPress={() => deleteChat(chat.id)}
      >
        <Ionicons name="trash-bin-outline" size={16} color="#888" />
      </Pressable>
    </Pressable>
  );

  // Drawer slide-in translation
  const translateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 0],
  });

  // Load memory context from AsyncStorage
  const loadMemoryContext = async () => {
    try {
      const storedMemory = await AsyncStorage.getItem('memory_context');
      if (storedMemory) {
        const parsedMemory = JSON.parse(storedMemory);
        setMemoryContext(parsedMemory);
      }
    } catch (error) {
      console.log('Failed to load memory context:', error);
    }
  };

  // Save memory context to AsyncStorage
  const saveMemoryContext = async () => {
    try {
      await AsyncStorage.setItem('memory_context', JSON.stringify(memoryContext));
    } catch (error) {
      console.log('Failed to save memory context:', error);
    }
  };

  // Update memory context with new information
  const updateMemoryContext = (newInfo: Partial<MemoryContext>) => {
    console.log('Updating memory context with:', JSON.stringify(newInfo));
    setMemoryContext(prev => {
      const updated = {
        ...prev,
        ...newInfo,
        lastUpdated: Date.now()
      };
      console.log('New memory context:', JSON.stringify(updated));
      return updated;
    });
  };

  // Function to clear memory context
  const clearMemoryContext = () => {
    setMemoryContext({
      lastUpdated: Date.now()
    });
    setShowMemoryModal(false);
  };

  // Format complex objects for display
  const formatValueForDisplay = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.map(item => formatValueForDisplay(item)).join(', ')}]`;
      } else {
        try {
          return JSON.stringify(value, null, 2);
        } catch (e) {
          return 'Complex object';
        }
      }
    }
    
    return String(value);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        {activeChat ? (
          <Pressable 
            style={styles.chatSelector}
            onPress={() => setShowChatList(!showChatList)}
          >
            <Ionicons 
              name="chatbubble-ellipses-outline" 
              size={18} 
              color="#888" 
              style={styles.chatIcon}
            />
            <ThemedText style={styles.title} numberOfLines={1}>
              {activeChat.title}
            </ThemedText>
            <Ionicons 
              name={showChatList ? "menu" : "menu-outline"} 
              size={16} 
              color="#666" 
            />
          </Pressable>
        ) : (
          <View style={styles.emptyHeaderLeft}>
            <ThemedText style={styles.headerTitle}>Giggity Chat</ThemedText>
          </View>
        )}
        
        {activeChat ? (
          <View style={styles.headerButtons}>
            <Pressable 
              onPress={() => setShowMemoryModal(true)}
              style={styles.headerButton}
            >
              <Ionicons name="bookmark-outline" size={20} color="#888" />
            </Pressable>
            <Pressable 
              onPress={createNewChat} 
              style={styles.headerButton}
            >
              <Ionicons name="add-outline" size={20} color="#888" />
            </Pressable>
            <Pressable 
              onPress={clearCurrentChat} 
              style={styles.headerButton}
            >
              <Ionicons name="trash-outline" size={16} color="#888" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerButtons}>
            <Pressable 
              onPress={() => setShowMemoryModal(true)}
              style={styles.headerButton}
            >
              <Ionicons name="bookmark-outline" size={20} color="#888" />
            </Pressable>
            <Pressable 
              onPress={handleStartNewChat}
              style={styles.headerCreateButton}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <ThemedText style={styles.headerCreateButtonText}>New Chat</ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>

      <View style={styles.contentContainer}>
        {/* Chat List Drawer */}
        {showChatList && (
          <Animated.View
            style={[
              styles.chatListDrawer,
              { transform: [{ translateX }] }
            ]}
          >
            <View style={styles.chatListHeader}>
              <ThemedText style={styles.chatListTitle}>Your Chats</ThemedText>
              <Pressable 
                onPress={createNewChat}
                style={styles.newChatButton}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <ThemedText style={styles.newChatButtonText}>New</ThemedText>
              </Pressable>
            </View>
            
            <ScrollView style={styles.chatList}>
              {chats.length > 0 ? (
                chats.map(renderChatItem)
              ) : (
                <ThemedText style={styles.noChatText}>No chats yet</ThemedText>
              )}
            </ScrollView>
          </Animated.View>
        )}

        {/* Main Chat Area */}
        <View style={styles.chatArea}>
          {activeChat ? (
            <FlatList
              ref={flatListRef}
              data={activeChat.messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesListContent}
            />
          ) : (
            <ThemedView style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={60} color="#444" style={styles.emptyStateIcon} />
              <ThemedText style={styles.emptyStateText}>
                No Active Conversations
              </ThemedText>
              <ThemedText style={styles.emptyStateSubText}>
                Type a message below to start a new chat
              </ThemedText>
              <Pressable 
                onPress={handleStartNewChat} 
                style={styles.newChatPrimaryButton}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <ThemedText style={styles.newChatPrimaryButtonText}>
                  Create New Chat
                </ThemedText>
              </Pressable>
              <Animated.View 
                style={[
                  styles.typeHintContainer,
                  { 
                    opacity: arrowAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1]
                    }),
                    transform: [{
                      translateY: arrowAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 10]
                      })
                    }]
                  }
                ]}
              >
                <Ionicons name="arrow-down" size={24} color="#666" />
              </Animated.View>
            </ThemedView>
          )}
        </View>
      </View>
      
      {/* Always show the input bar, regardless of whether a chat exists */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ThemedView style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={activeChat ? "Type a message..." : "Type to start a new chat..."}
            placeholderTextColor="#666"
            multiline
          />
          <Pressable 
            onPress={handleSendButtonPress}
            disabled={isLoading || inputText.trim() === ''}
            style={[
              styles.sendButton, 
              (isLoading || inputText.trim() === '') && styles.disabledButton
            ]}
          >
            {isLoading ? (
              <ThemedText style={styles.loadingDots}>...</ThemedText>
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>

      {/* Overlay when drawer is open */}
      {showChatList && (
        <Pressable 
          style={styles.overlay}
          onPress={() => setShowChatList(false)}
        />
      )}

      {/* Memory Context Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showMemoryModal}
        onRequestClose={() => setShowMemoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.memoryModal}>
            <View style={styles.memoryModalHeader}>
              <ThemedText style={styles.memoryModalTitle}>
                Bot Memory
              </ThemedText>
              <Pressable 
                onPress={() => setShowMemoryModal(false)}
                style={styles.closeModalButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            
            <ScrollView style={styles.memoryContent}>
              {Object.keys(memoryContext).length <= 1 ? (
                <ThemedText style={styles.emptyMemoryText}>
                  No memory stored yet. Chat with the bot to build its memory.
                </ThemedText>
              ) : (
                <View style={styles.memoryItemsContainer}>
                  {/* Raw memory display approach */}
                  <View style={styles.rawMemoryDisplay}>
                    <ThemedText style={styles.memoryRawTitle}>
                      Memory Data:
                    </ThemedText>
                    
                    <View style={styles.memoryTable}>
                      {Object.entries(memoryContext).map(([key, value], index) => (
                        <View key={index} style={[styles.memoryRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                          <ThemedText style={styles.memoryKey}>{key}</ThemedText>
                          <ThemedText style={styles.memoryValueRaw} numberOfLines={2} ellipsizeMode="tail">
                            {typeof value === 'object' 
                              ? JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '')
                              : String(value)}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    
                    <ThemedText style={styles.memoryTimestamp}>
                      Last updated: {new Date(memoryContext.lastUpdated).toLocaleString()}
                    </ThemedText>
                  </View>
                </View>
              )}
            </ScrollView>
            
            <Pressable 
              onPress={clearMemoryContext}
              style={styles.clearMemoryButton}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <ThemedText style={styles.clearMemoryButtonText}>
                Clear Memory
              </ThemedText>
            </Pressable>
            
            {/* Debug button */}
            <Pressable 
              onPress={() => console.log('FULL MEMORY CONTEXT:', JSON.stringify(memoryContext, null, 2))}
              style={[styles.clearMemoryButton, { marginTop: 8, backgroundColor: '#555' }]}
            >
              <Ionicons name="code-outline" size={18} color="#fff" />
              <ThemedText style={styles.clearMemoryButtonText}>
                Debug: Log Memory
              </ThemedText>
            </Pressable>
            
            {/* Raw JSON button */}
            <Pressable 
              onPress={() => {
                alert(JSON.stringify(memoryContext, null, 2));
              }}
              style={[styles.clearMemoryButton, { marginTop: 8, backgroundColor: '#333' }]}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <ThemedText style={styles.clearMemoryButtonText}>
                Show Raw JSON
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    zIndex: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 6,
    marginLeft: 8,
    maxWidth: 180,
  },
  chatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  chatIcon: {
    marginRight: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#222',
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    padding: 12,
    paddingBottom: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  messageContainer: {
    padding: 12,
    borderRadius: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#222',
  },
  userMessageText: {
    color: '#fff',
    fontSize: 15,
  },
  botMessageText: {
    color: '#eee',
    fontSize: 15,
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    alignSelf: 'flex-end',
    marginTop: 15,
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333',
    zIndex: 2,
  },
  input: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    color: '#eee',
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#444',
  },
  loadingDots: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateIcon: {
    marginBottom: 20,
    opacity: 0.7,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyStateSubText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  newChatPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 28,
    elevation: 2,
  },
  newChatPrimaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1,
  },
  chatListDrawer: {
    width: 280,
    backgroundColor: '#1A1A1A',
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  chatListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  chatListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  newChatButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  activeChatItem: {
    backgroundColor: '#222',
  },
  chatItemContent: {
    flex: 1,
  },
  chatItemTitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  chatItemDate: {
    fontSize: 11,
    color: '#888',
  },
  chatItemDelete: {
    padding: 8,
  },
  noChatText: {
    textAlign: 'center',
    padding: 20,
    color: '#888',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'left',
  },
  emptyHeaderLeft: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  headerCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  headerCreateButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 6,
    fontSize: 14,
  },
  typeHintContainer: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  memoryModal: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%',
  },
  memoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  memoryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeModalButton: {
    padding: 8,
  },
  memoryContent: {
    flex: 1,
  },
  emptyMemoryText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
  },
  memoryItemsContainer: {
    flex: 1,
  },
  rawMemoryDisplay: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 15,
  },
  memoryRawTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  memoryTable: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  memoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  memoryKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  memoryValueRaw: {
    fontSize: 14,
    color: '#eee',
    flex: 2,
    textAlign: 'right',
  },
  clearMemoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 16,
    marginTop: 10,
  },
  clearMemoryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  evenRow: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  oddRow: {
    backgroundColor: '#1A1A1A',
  },
  memoryTimestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    alignSelf: 'flex-end',
    marginTop: 15,
    marginBottom: 5,
  },
}); 