import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Animated, Modal, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

export function HomeSections() {
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const inputHeight = useRef(new Animated.Value(0)).current;

  const toggleInput = () => {
    setShowInput(!showInput);
    Animated.timing(inputHeight, {
      toValue: showInput ? 0 : 60,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const closeInput = () => {
    if (showInput) {
      setShowInput(false);
      Animated.timing(inputHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const toggleTodo = (id: number) => {
    setTodoItems(todos => 
      todos.map(todo => 
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
    setTodoItems(todos => todos.filter(todo => todo.id !== id));
  };

  const addNewTask = () => {
    if (newTaskText.trim()) {
      const newTask: TodoItem = {
        id: todoItems.length + 1,
        text: newTaskText.trim(),
        done: false
      };
      setTodoItems([...todoItems, newTask]);
      setNewTaskText('');
      closeInput();
    }
  };

  return (
    <View style={styles.container}>
      {/* Todo List Section */}
      <View style={styles.sectionContainer}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Today's Tasks</ThemedText>
        <ThemedView style={styles.todoContainer}>
          <ScrollView style={styles.todoScrollView}>
            {todoItems.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>No tasks added</ThemedText>
              </View>
            ) : (
              todoItems.map((todo) => (
                <View key={todo.id} style={styles.todoItemContainer}>
                  <TouchableOpacity
                    style={styles.todoItem}
                    onPress={() => toggleTodo(todo.id)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[
                      styles.todoText,
                      todo.done && styles.todoCompleted
                    ]}>
                      {todo.done ? '✓' : '○'} {todo.text}
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteTodo(todo.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
          
          {/* Add Button */}
          <TouchableOpacity 
            style={styles.plusButton}
            onPress={toggleInput}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.plusButtonText}>+</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>

      {/* Overlay for clicking outside */}
      <Modal
        visible={showInput}
        transparent={true}
        animationType="fade"
        onRequestClose={closeInput}
      >
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={closeInput}
        >
          <View style={styles.overlayContent}>
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.newTaskContainer}>
                <Animated.View style={{ height: inputHeight, overflow: 'hidden' }}>
                  <TextInput
                    style={styles.input}
                    value={newTaskText}
                    onChangeText={setNewTaskText}
                    placeholder="Add a new task..."
                    placeholderTextColor="#666"
                    autoFocus={true}
                  />
                </Animated.View>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={addNewTask}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.addButtonText}>Add</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
  },
  sectionContainer: {
    marginBottom: 20,
    marginTop: 0,
    paddingTop: 0,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 18,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    height: 100,
  },
  todoContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    height: 280,
    position: 'relative',
  },
  todoScrollView: {
    flex: 1,
    maxHeight: 200,
  },
  todoItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 1,
  },
  todoItem: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    height: 60,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
  todoText: {
    fontSize: 16,
    color: '#000000',
  },
  todoCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  newTaskContainer: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    fontSize: 16,
    marginRight: 12,
  },
  plusButton: {
    backgroundColor: '#666666',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  plusButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 24,
  },
  addButton: {
    backgroundColor: '#666666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 60,
    height: 60,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});