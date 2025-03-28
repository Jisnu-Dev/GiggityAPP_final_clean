import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { DataItem, JsonLoadResponse } from '@/types/json';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface JsonViewerProps<T extends DataItem> {
  // The JSON loading response from the useJsonLoader hook
  jsonResponse: JsonLoadResponse<T[]>;
  
  // Title to display at the top of the viewer
  title?: string;
  
  // Function to render each item (optional - default provided)
  renderItem?: (item: T, index: number) => React.ReactNode;
  
  // Key extractor function (optional - default uses item.id)
  keyExtractor?: (item: T, index: number) => string;
  
  // Callback when retry button is pressed
  onRetry?: () => void;
  
  // Style overrides
  containerStyle?: object;
  listStyle?: object;
}

/**
 * A reusable component for displaying JSON data with loading and error states
 */
export function JsonViewer<T extends DataItem>({
  jsonResponse,
  title = 'JSON Data',
  renderItem,
  keyExtractor,
  onRetry,
  containerStyle,
  listStyle,
}: JsonViewerProps<T>) {
  const { isLoading, data, error } = jsonResponse;

  // Default key extractor uses the item's id
  const defaultKeyExtractor = (item: T, index: number): string => {
    return item.id?.toString() || index.toString();
  };

  // Default item renderer shows JSON key/value pairs
  const defaultRenderItem = (item: T, index: number) => {
    return (
      <View style={styles.item}>
        <ThemedText style={styles.itemTitle}>Item {index + 1}</ThemedText>
        {Object.entries(item).map(([key, value]) => (
          <View key={key} style={styles.property}>
            <ThemedText style={styles.key}>{key}: </ThemedText>
            <ThemedText style={styles.value}>
              {typeof value === 'object' 
                ? JSON.stringify(value) 
                : value?.toString() || 'null'}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <ThemedView style={[styles.container, containerStyle]}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a86f7" />
          <ThemedText style={styles.loadingText}>Loading data...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <ThemedView style={[styles.container, containerStyle]}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            {error || 'Failed to load data'}
          </ThemedText>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ThemedView>
    );
  }

  // Empty data state
  if (data.length === 0) {
    return (
      <ThemedView style={[styles.container, containerStyle]}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No data available</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Data display state
  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <FlatList
        data={data}
        keyExtractor={keyExtractor || defaultKeyExtractor}
        renderItem={({ item, index }) => 
          renderItem ? renderItem(item, index) : defaultRenderItem(item, index)
        }
        style={[styles.list, listStyle]}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  property: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 4,
  },
  key: {
    fontWeight: '500',
  },
  value: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4a86f7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
}); 