import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import { Animated } from 'react-native';

export function AppHeader() {
  const [showMenu, setShowMenu] = useState(false);
  const menuWidth = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    setShowMenu(!showMenu);
    Animated.timing(menuWidth, {
      toValue: showMenu ? 0 : 250,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  return (
    <>
      <View style={styles.headerContainer}>
        <ThemedText type="title" style={styles.title}>GunduApp</ThemedText>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={toggleMenu}
        >
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Side Menu */}
      <Animated.View style={[styles.sideMenu, { width: menuWidth }]}>
        <View style={styles.menuHeader}>
          <ThemedText style={styles.menuHeaderText}>Menu</ThemedText>
          <TouchableOpacity onPress={toggleMenu} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={22} color="#ffffff" />
          <ThemedText style={styles.menuItemText}>Settings</ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 45,
    marginBottom: 0,
    height: 45,
    backgroundColor: '#121212',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
  },
  menuButton: {
    padding: 8,
  },
  sideMenu: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 1,
    borderLeftColor: '#333333',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  menuHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#ffffff',
  },
}); 