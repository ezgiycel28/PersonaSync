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
import { registerUser, loginUser, getUser } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

// JWT token decoder
function decodeToken(token: string): { user_id: number; sub: string } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export default function RegisterScreen() {
  const { login } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    // Validations
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Lütfen adınızı ve soyadınızı girin');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen email adresinizi girin');
      return;
    }
    if (!validateEmail(email.trim())) {
      Alert.alert('Hata', 'Geçerli bir email adresi girin');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor');
      return;
    }

    setIsLoading(true);
    try {
      // Kayıt ol
      await registerUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });

      // Otomatik giriş yap
      const tokenResponse = await loginUser({
        email: email.trim(),
        password,
      });

      // Token'dan user_id al
      const decoded = decodeToken(tokenResponse.access_token);
      if (!decoded) {
        throw new Error('Token çözümlenemedi');
      }

      // Kullanıcı bilgilerini al
      const userData = await getUser(decoded.user_id, tokenResponse.access_token);

      // Context'e kaydet
      await login(tokenResponse, userData);

      // Profil tamamlama sayfasına yönlendir
      router.replace('/complete-profile');
    } catch (error) {
      Alert.alert('Kayıt Başarısız', error instanceof Error ? error.message : 'Bir hata oluştu');
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>✨</Text>
          </View>
          <Text style={styles.appName}>PersonaSync</Text>
          <Text style={styles.tagline}>Yolculuğuna Başla</Text>
        </View>

        {/* Register Form */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Hesap Oluştur</Text>
          <Text style={styles.subtitleText}>Hemen ücretsiz kayıt ol</Text>

          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Ad Soyad</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Adınız Soyadınız"
                placeholderTextColor={PersonaSyncColors.gray}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>
          </View>

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
                placeholder="En az 6 karakter"
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

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Şifre Tekrar</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔐</Text>
              <TextInput
                style={styles.input}
                placeholder="Şifrenizi tekrar girin"
                placeholderTextColor={PersonaSyncColors.gray}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                <View
                  style={[
                    styles.strengthBar,
                    { backgroundColor: password.length >= 1 ? PersonaSyncColors.error : PersonaSyncColors.lightGray },
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    { backgroundColor: password.length >= 4 ? PersonaSyncColors.warning : PersonaSyncColors.lightGray },
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    { backgroundColor: password.length >= 6 ? PersonaSyncColors.success : PersonaSyncColors.lightGray },
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    { backgroundColor: password.length >= 8 ? PersonaSyncColors.success : PersonaSyncColors.lightGray },
                  ]}
                />
              </View>
              <Text style={styles.strengthText}>
                {password.length < 4 ? 'Zayıf' : password.length < 6 ? 'Orta' : password.length < 8 ? 'İyi' : 'Güçlü'}
              </Text>
            </View>
          )}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={PersonaSyncColors.white} />
            ) : (
              <Text style={styles.registerButtonText}>Kayıt Ol</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Zaten hesabın var mı? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>Giriş Yap</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          Kayıt olarak{' '}
          <Text style={styles.termsLink}>Kullanım Şartları</Text>
          {' '}ve{' '}
          <Text style={styles.termsLink}>Gizlilik Politikası</Text>
          'nı kabul etmiş olursunuz.
        </Text>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.xl,
    backgroundColor: PersonaSyncColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.lg,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: PersonaSyncColors.primary,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  inputContainer: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PersonaSyncColors.charcoal,
    marginBottom: 4,
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
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 15,
    color: PersonaSyncColors.charcoal,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  eyeIcon: {
    fontSize: 16,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  strengthBars: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    color: PersonaSyncColors.darkGray,
    marginLeft: Spacing.sm,
    width: 45,
  },
  registerButton: {
    backgroundColor: PersonaSyncColors.accent,
    borderRadius: BorderRadius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    ...Shadows.md,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  loginText: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: PersonaSyncColors.accent,
  },
  termsText: {
    fontSize: 12,
    color: PersonaSyncColors.secondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});