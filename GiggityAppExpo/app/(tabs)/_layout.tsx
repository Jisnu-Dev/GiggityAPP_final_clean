import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          height: 75,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 18,
          fontWeight: "600",
          paddingBottom: 5,
        },
        tabBarIconStyle: {
          width: 32,
          height: 32,
          marginTop: 5,
        },
        headerStyle: {
          height: 0,
          padding: 0,
        },
        headerShown: false,
        tabBarActiveTintColor: colorScheme === "dark" ? "#fff" : "#000",
        tabBarInactiveTintColor: colorScheme === "dark" ? "#666" : "#999",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ color, fontSize: 24 }}>🏠</ThemedText>
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ color, fontSize: 24 }}>📔</ThemedText>
          ),
        }}
      />
      <Tabs.Screen
        name="facerecognition"
        options={{
          title: "Face Rec",
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ color, fontSize: 24 }}>👤</ThemedText>
          ),
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          title: "Location",
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ color, fontSize: 24 }}>📍</ThemedText>
          ),
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: "ChatBot",
          tabBarIcon: ({ color }) => (
            <ThemedText style={{ color, fontSize: 24 }}>🤖</ThemedText>
          ),
        }}
      />
    </Tabs>
  );
}
