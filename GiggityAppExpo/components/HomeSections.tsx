import { StyleSheet, View, ScrollView, TouchableOpacity, TextInput, Animated, Modal, Dimensions, ActivityIndicator, Alert, Platform, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { 
  listTranscriptedFiles, 
  loadTranscriptedJson, 
  saveTranscriptedJson,
  deleteTranscriptedFile,
  getTranscriptDataPath,
  getTransDataFiles,
  loadTransDataFile
} from '@/utils/jsonLoader';
import { addTranscriptedTask, TranscriptedTask as TranscriptedTaskType } from '@/utils/transcriptService';

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

// New interface for JSON files from TransData
interface TransDataJsonFile {
  id: string;
  filename: string;
  createdAt: string;
}

export function HomeSections() {
  // Adding new state for TransData files
  const [transDataFiles, setTransDataFiles] = useState<TransDataJsonFile[]>([]);
  const [isLoadingTransDataFiles, setIsLoadingTransDataFiles] = useState(false);
  
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [transcriptedItems, setTranscriptedItems] = useState<TranscriptedTaskType[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [isLoadingTranscriptedTasks, setIsLoadingTranscriptedTasks] = useState(true);
  const inputHeight = useRef(new Animated.Value(0)).current;
  
  // Add state for file preview
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [showFilePreview, setShowFilePreview] = useState(false);

  // Load transcripted tasks on component mount
  useEffect(() => {
    loadTranscriptedTasks();
    // Don't load TransData files yet - we'll do it on demand
  }, []);
  
  // Direct function to load TransData files
  const loadTransDataFilesList = async () => {
    try {
      console.log("DIRECT LOAD: Starting to load TransData files");
      setIsLoadingTransDataFiles(true);
      
      // Clear existing state
      setTransDataFiles([]);
      
      // Get files directly from the filesystem
      const files = await getTransDataFiles();
      console.log("DIRECT LOAD: Found files:", files);
      
      if (files.length > 0) {
        // Create new file objects with unique IDs
        const timestamp = Date.now();
        const fileItems = files.map(filename => ({
          id: `transdata_${filename}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          filename,
          createdAt: new Date().toISOString()
        }));
        
        setTransDataFiles(fileItems);
      }
    } catch (error) {
      console.error("DIRECT LOAD ERROR:", error);
      Alert.alert("Error", "Failed to load TransData files");
    } finally {
      setIsLoadingTransDataFiles(false);
    }
  };
  
  // View file content
  const viewFileContent = async (filename: string) => {
    try {
      console.log("DIRECT VIEW: Loading file", filename);
      setSelectedFile(filename);
      setFileContent(null); // Clear previous content
      setShowFilePreview(true);
      
      // Load file content
      const content = await loadTransDataFile(filename);
      setFileContent(content);
    } catch (error) {
      console.error("DIRECT VIEW ERROR:", error);
      setFileContent(null);
      Alert.alert("Error", `Could not load file ${filename}`);
    }
  };
  
  // Close file preview
  const closeFilePreview = () => {
    setShowFilePreview(false);
    setSelectedFile(null);
    setFileContent(null);
  };

  const loadTranscriptedTasks = async () => {
    try {
      setIsLoadingTranscriptedTasks(true);
      
      // Get a list of all JSON files in the Task folder
      const files = await listTranscriptedFiles('Task');
      
      if (files.length === 0) {
        // If no files exist, let's create a sample file
        await createSampleTaskFile();
        
        // After creating the sample file, load it
        const newFiles = await listTranscriptedFiles('Task');
        if (newFiles.length > 0) {
          await loadTaskFiles(newFiles);
        } else {
          setTranscriptedItems([]);
        }
      } else {
        // Load existing task files
        await loadTaskFiles(files);
      }
    } catch (error) {
      console.error('Error loading transcripted tasks:', error);
      setTranscriptedItems([]);
    } finally {
      setIsLoadingTranscriptedTasks(false);
    }
  };

  const loadTaskFiles = async (files: string[]) => {
    try {
      // Load all task files and combine the tasks
      const allTasks: TranscriptedTaskType[] = [];
      
      for (const file of files) {
        try {
          const tasks = await loadTranscriptedJson<TranscriptedTaskType[]>('Task', file);
          if (Array.isArray(tasks)) {
            allTasks.push(...tasks);
          }
        } catch (err) {
          console.error(`Error loading ${file}:`, err);
        }
      }
      
      // Sort tasks by creation date, newest first
      allTasks.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setTranscriptedItems(allTasks);
    } catch (error) {
      console.error('Error loading task files:', error);
      setTranscriptedItems([]);
    }
  };

  const createSampleTaskFile = async () => {
    try {
      // Load the sample task file from assets
      const assetUri = require('../assets/data/sample-task.json');
      
      // Save it to the TranscriptData/Task directory
      await saveTranscriptedJson('Task', 'sample-tasks.json', assetUri);
    } catch (error) {
      console.error('Error creating sample task file:', error);
    }
  };

  // Add a demo transcripted task
  const addDemoTranscriptedTask = async () => {
    try {
      // Create a new task with the current timestamp
      const taskText = `Transcripted task created at ${new Date().toLocaleTimeString()}`;
      
      // Add it using the transcript service
      const newTask = await addTranscriptedTask(
        taskText, 
        'Demo transcription source'
      );
      
      // Update the list by adding the new task at the beginning
      setTranscriptedItems(prev => [newTask, ...prev]);
    } catch (error) {
      console.error('Error adding demo transcripted task:', error);
    }
  };

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

  const toggleTranscripted = (id: string) => {
    setTranscriptedItems(items => {
      const updatedItems = items.map(item => 
        item.id === id ? { ...item, done: !item.done } : item
      );
      
      // Find which file the task is in and update it
      updateTranscriptedTaskInFiles(id, updatedItems);
      
      return updatedItems;
    });
  };

  const updateTranscriptedTaskInFiles = async (taskId: string, updatedItems: TranscriptedTaskType[]) => {
    try {
      // Get the task that was updated
      const updatedTask = updatedItems.find(item => item.id === taskId);
      if (!updatedTask) return;
      
      // Get all files
      const files = await listTranscriptedFiles('Task');
      
      // Try to find the file containing this task and update it
      for (const file of files) {
        try {
          const tasks = await loadTranscriptedJson<TranscriptedTaskType[]>('Task', file);
          
          if (Array.isArray(tasks)) {
            const taskIndex = tasks.findIndex(task => task.id === taskId);
            
            if (taskIndex >= 0) {
              // Task found in this file, update it
              tasks[taskIndex] = updatedTask;
              await saveTranscriptedJson('Task', file, tasks);
              break; // Stop after updating the file
            }
          }
        } catch (err) {
          console.error(`Error updating task in ${file}:`, err);
        }
      }
    } catch (error) {
      console.error('Error updating transcripted task:', error);
    }
  };

  const deleteTodo = (id: number) => {
    setTodoItems(todos => todos.filter(todo => todo.id !== id));
  };

  const deleteTranscripted = async (id: string) => {
    try {
      // Update the state first for immediate UI feedback
      setTranscriptedItems(items => {
        const updatedItems = items.filter(item => item.id !== id);
        
        // Find and update the file this task is in
        deleteTranscriptedTaskFromFiles(id);
        
        return updatedItems;
      });
    } catch (error) {
      console.error('Error deleting transcripted task:', error);
    }
  };

  const deleteTranscriptedTaskFromFiles = async (taskId: string) => {
    try {
      // Get all files
      const files = await listTranscriptedFiles('Task');
      
      // Find the file containing this task and update it
      for (const file of files) {
        try {
          const tasks = await loadTranscriptedJson<TranscriptedTaskType[]>('Task', file);
          
          if (Array.isArray(tasks)) {
            const taskIndex = tasks.findIndex(task => task.id === taskId);
            
            if (taskIndex >= 0) {
              // Task found in this file, remove it
              tasks.splice(taskIndex, 1);
              
              // If the file is now empty, delete it (unless it's the sample file)
              if (tasks.length === 0 && file !== 'sample-tasks.json') {
                await deleteTranscriptedFile('Task', file);
              } else {
                // Otherwise update the file with the task removed
                await saveTranscriptedJson('Task', file, tasks);
              }
              
              break; // Stop after updating the file
            }
          }
        } catch (err) {
          console.error(`Error deleting task from ${file}:`, err);
        }
      }
    } catch (error) {
      console.error('Error deleting transcripted task from files:', error);
    }
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

  // Format a date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
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

      {/* Transcripted Tasks Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Transcripted Tasks</ThemedText>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={addDemoTranscriptedTask}
              activeOpacity={0.7}
            >
              <Ionicons name="add-outline" size={20} color="#555" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.headerButton}
              onPress={loadTransDataFilesList}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-open-outline" size={20} color="#555" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.headerButton}
              onPress={loadTranscriptedTasks}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={20} color="#555" />
            </TouchableOpacity>
          </View>
        </View>
        <ThemedView style={styles.todoContainer}>
          {isLoadingTranscriptedTasks ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4a86f7" />
              <ThemedText style={styles.loadingText}>Loading transcripted tasks...</ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.todoScrollView}>
              {transcriptedItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateText}>No transcripted tasks available</ThemedText>
                </View>
              ) : (
                transcriptedItems.map((item) => (
                  <View key={item.id} style={styles.todoItemContainer}>
                    <TouchableOpacity
                      style={styles.transcriptedItem}
                      onPress={() => toggleTranscripted(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.taskHeader}>
                        <ThemedText style={[
                          styles.todoText,
                          item.done && styles.todoCompleted
                        ]}>
                          {item.done ? '✓' : '○'} {item.text}
                        </ThemedText>
                        <ThemedText style={styles.timeText}>
                          {formatDate(item.createdAt)}
                        </ThemedText>
                      </View>
                      {item.source && (
                        <ThemedText style={styles.sourceText}>
                          Source: {item.source}
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteTranscripted(item.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </ThemedView>
      </View>

      {/* TransData Files Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>TransData Files</ThemedText>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={loadTransDataFilesList}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color="#555" />
          </TouchableOpacity>
        </View>
        <ThemedView style={styles.todoContainer}>
          {isLoadingTransDataFiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4a86f7" />
              <ThemedText style={styles.loadingText}>Loading TransData files...</ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.todoScrollView}>
              {transDataFiles.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateText}>
                    No JSON files in TransData folder
                  </ThemedText>
                </View>
              ) : (
                transDataFiles.map((file) => (
                  <View key={file.id} style={styles.todoItemContainer}>
                    <TouchableOpacity
                      style={styles.transcriptedItem}
                      onPress={() => viewFileContent(file.filename)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.taskHeader}>
                        <ThemedText style={styles.todoText}>
                          📄 {file.filename}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.sourceText}>
                        Click to view file content
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}
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

      {/* File preview modal */}
      <Modal
        visible={showFilePreview}
        transparent={true}
        animationType="slide"
        onRequestClose={closeFilePreview}
      >
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={closeFilePreview}
        >
          <View style={styles.filePreviewContent}>
            <View style={styles.filePreviewHeader}>
              <ThemedText style={styles.filePreviewTitle}>
                {selectedFile}
              </ThemedText>
              <TouchableOpacity onPress={closeFilePreview}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filePreviewScroll}>
              {fileContent ? (
                <ThemedText style={styles.filePreviewCode}>
                  {JSON.stringify(fileContent, null, 2)}
                </ThemedText>
              ) : (
                <ThemedText style={styles.filePreviewCode}>
                  Loading content...
                </ThemedText>
              )}
            </ScrollView>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 6,
    marginLeft: 8,
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
  transcriptedItem: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todoText: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  todoCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  sourceText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  deleteButton: {
    padding: 16,
    height: 60,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
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
    backgroundColor: '#4a86f7',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#888',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  overlayContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
  },
  filePreviewContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    maxHeight: '80%',
    width: '100%',
    marginTop: 'auto'
  },
  filePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filePreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  filePreviewScroll: {
    maxHeight: 400,
  },
  filePreviewCode: {
    fontFamily: 'monospace',
    fontSize: 14,
  }
}); 