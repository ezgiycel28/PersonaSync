import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { PersonaSyncColors } from '@/constants/theme';

// Auth durumuna göre yönlendirme yapan wrapper
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inCompleteProfile = segments[0] === 'complete-profile';

    if (!isAuthenticated) {
      // Giriş yapmamış - auth sayfalarına yönlendir
      if (!inAuthGroup) {
        router.replace('/login');
      }
    } else {
      // Giriş yapmış
      if (user && !user.is_profile_complete) {
        // Profil tamamlanmamış
        if (!inCompleteProfile) {
          router.replace('/complete-profile');
        }
      } else {
        // Profil tamamlanmış - ana sayfaya git
        if (inAuthGroup || inCompleteProfile) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isAuthenticated, isLoading, user, segments]);

  // Yükleniyor durumu
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PersonaSyncColors.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PersonaSyncColors.primary,
  },
});