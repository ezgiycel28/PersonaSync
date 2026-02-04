import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { loginUser, getUser } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

// JWT token'dan user_id çıkarmak için basit decoder
function decodeToken(token: string): { user_id: number; sub: string } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen email adresinizi girin');
      return;
    }
    if (!password) {
      Alert.alert('Hata', 'Lütfen şifrenizi girin');
      return;
    }

    setIsLoading(true);
    try {
      // Login API çağrısı
      const tokenResponse = await loginUser({ email: email.trim(), password });
      
      // Token'dan user_id al
      const decoded = decodeToken(tokenResponse.access_token);
      if (!decoded) {
        throw new Error('Token çözümlenemedi');
      }

      // Kullanıcı bilgilerini al
      const userData = await getUser(decoded.user_id, tokenResponse.access_token);
      
      // Context'e kaydet
      await login(tokenResponse, userData);

      // Profil tamamlanmış mı kontrol et
      if (!userData.is_profile_complete) {
        router.replace('/complete-profile');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      Alert.alert('Giriş Başarısız', error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🚀</Text>
          </View>
          <Text style={styles.appName}>PersonaSync</Text>
          <Text style={styles.tagline}>Kişisel Verimlilik Koçun</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Tekrar Hoş Geldin!</Text>
          <Text style={styles.subtitleText}>Hesabına giriş yap</Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@email.com"
                placeholderTextColor={PersonaSyncColors.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Şifre</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={PersonaSyncColors.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={PersonaSyncColors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Hesabın yok mu? </Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLink}>Kayıt Ol</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Bottom Decoration */}
        <View style={styles.bottomDecoration}>
          <View style={styles.decorationLine} />
          <Text style={styles.decorationText}>🌟</Text>
          <View style={styles.decorationLine} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PersonaSyncColors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: PersonaSyncColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.lg,
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: PersonaSyncColors.secondary,
    marginTop: Spacing.xs,
  },
  formContainer: {
    backgroundColor: PersonaSyncColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PersonaSyncColors.primary,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PersonaSyncColors.charcoal,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PersonaSyncColors.offWhite,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: PersonaSyncColors.lightGray,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: PersonaSyncColors.charcoal,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  eyeIcon: {
    fontSize: 18,
  },
  loginButton: {
    backgroundColor: PersonaSyncColors.accent,
    borderRadius: BorderRadius.md,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  registerText: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: PersonaSyncColors.accent,
  },
  bottomDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  decorationLine: {
    flex: 1,
    height: 1,
    backgroundColor: PersonaSyncColors.secondary,
    opacity: 0.3,
  },
  decorationText: {
    fontSize: 20,
    marginHorizontal: Spacing.md,
  },
});