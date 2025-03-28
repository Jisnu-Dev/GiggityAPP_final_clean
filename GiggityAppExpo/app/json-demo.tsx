import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, TextInput, Switch, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { JsonViewer } from '@/components/JsonViewer';
import { useLocalJsonAsset, useRemoteJson } from '@/hooks/useJsonLoader';
import { DataItem } from '@/types/json';

// Define the type for our task items
interface TaskItem extends DataItem {
  title: string;
  description: string;
  completed: boolean;
  priority: string;
  tags: string[];
}

export default function JsonDemoScreen() {
  // State for IP address and port
  const [serverIp, setServerIp] = useState('192.168.1.X'); // Replace with your laptop's IP
  const [serverPort, setServerPort] = useState('3000');
  const [useLocalAssets, setUseLocalAssets] = useState(true);
  
  // Toggle between local and remote loading
  const toggleSource = useCallback(() => {
    setUseLocalAssets(!useLocalAssets);
  }, [useLocalAssets]);

  // Validate server settings
  const validateServerSettings = useCallback(() => {
    if (!serverIp.trim()) {
      Alert.alert('Error', 'Please enter a valid IP address');
      return false;
    }
    
    if (!serverPort.trim() || isNaN(parseInt(serverPort, 10))) {
      Alert.alert('Error', 'Please enter a valid port number');
      return false;
    }
    
    return true;
  }, [serverIp, serverPort]);
  
  // Loading from local asset
  const localJsonResponse = useLocalJsonAsset<TaskItem>('data/example.json');
  
  // Loading from remote server (only if using remote and settings are valid)
  const remoteJsonResponse = useRemoteJson<TaskItem>(
    serverIp,
    parseInt(serverPort, 10),
    'tasks', // Endpoint on your JSON server
    10000    // 10 second timeout
  );
  
  // Choose which data source to use
  const jsonResponse = useLocalAssets ? localJsonResponse : remoteJsonResponse;
  
  // Custom render function for task items
  const renderTaskItem = (item: TaskItem, index: number) => {
    return (
      <View style={styles.taskItem}>
        <View style={styles.taskHeader}>
          <ThemedText style={styles.taskTitle}>{item.title}</ThemedText>
          <View style={[
            styles.priorityBadge, 
            styles[`priority${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}` as keyof typeof styles]
          ]}>
            <ThemedText style={styles.priorityText}>{item.priority}</ThemedText>
          </View>
        </View>
        
        <ThemedText style={styles.taskDescription}>{item.description}</ThemedText>
        
        <View style={styles.taskFooter}>
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusDot,
              item.completed ? styles.statusCompleted : styles.statusPending
            ]} />
            <ThemedText style={styles.statusText}>
              {item.completed ? 'Completed' : 'Pending'}
            </ThemedText>
          </View>
          
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, tagIndex) => (
              <View key={tagIndex} style={styles.tag}>
                <ThemedText style={styles.tagText}>{tag}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // When retry is requested
  const handleRetry = useCallback(() => {
    if (!useLocalAssets && !validateServerSettings()) {
      return;
    }
    
    // Force a re-render to retry
    setUseLocalAssets(prevState => {
      // Toggle and toggle back to force refresh
      setTimeout(() => setUseLocalAssets(prevState), 0);
      return !prevState;
    });
  }, [useLocalAssets, validateServerSettings]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.settingsContainer}>
        <View style={styles.switchContainer}>
          <ThemedText style={styles.switchLabel}>Data Source:</ThemedText>
          <View style={styles.sourceToggle}>
            <ThemedText>Remote</ThemedText>
            <Switch
              value={useLocalAssets}
              onValueChange={toggleSource}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={useLocalAssets ? '#4a86f7' : '#f4f3f4'}
            />
            <ThemedText>Local</ThemedText>
          </View>
        </View>

        {!useLocalAssets && (
          <View style={styles.serverSettings}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>IP Address:</ThemedText>
              <TextInput
                style={styles.input}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="192.168.1.X"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Port:</ThemedText>
              <TextInput
                style={styles.input}
                value={serverPort}
                onChangeText={setServerPort}
                placeholder="3000"
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}
      </View>
      
      <JsonViewer<TaskItem>
        jsonResponse={jsonResponse}
        title={useLocalAssets ? "Local JSON Data" : "Remote JSON Data"}
        renderItem={renderTaskItem}
        onRetry={handleRetry}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  settingsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  sourceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serverSettings: {
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  taskItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4a86f7',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  priorityHigh: {
    backgroundColor: '#ffdddd',
  },
  priorityMedium: {
    backgroundColor: '#ffffdd',
  },
  priorityLow: {
    backgroundColor: '#ddffdd',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  taskDescription: {
    marginBottom: 12,
    color: '#666',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPending: {
    backgroundColor: '#ff9800',
  },
  statusCompleted: {
    backgroundColor: '#4caf50',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
  },
}); 