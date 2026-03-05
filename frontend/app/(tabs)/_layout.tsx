import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, PersonaSyncColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PersonaSyncColors.accent,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor:
            colorScheme === 'dark'
              ? PersonaSyncColors.primary
              : PersonaSyncColors.white,
          borderTopColor:
            colorScheme === 'dark'
              ? PersonaSyncColors.primaryLight
              : PersonaSyncColors.lightGray,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      {/* ── AI KOÇ — YENİ ─────────────────────── */}
      <Tabs.Screen
        name="coach"
        options={{
          title: 'AI Koç',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 30 : 26}
              name="brain.head.profile"
              color={color}
            />
          ),
          tabBarBadge: undefined,   // Bildirim sayacı gerekirse buraya
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="safari.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}