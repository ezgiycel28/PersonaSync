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
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { updateProfile } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PersonaSyncColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';

// Hedef seçenekleri
const GOALS = [
  { id: 'yks', label: 'YKS', emoji: '📚' },
  { id: 'kpss', label: 'KPSS', emoji: '📋' },
  { id: 'ales', label: 'ALES', emoji: '🎓' },
  { id: 'dil', label: 'Dil Sınavı', emoji: '🌍' },
  { id: 'universite', label: 'Üniversite Dersleri', emoji: '🏫' },
  { id: 'kariyer', label: 'Kariyer Gelişimi', emoji: '💼' },
  { id: 'kisisel', label: 'Kişisel Gelişim', emoji: '🌱' },
  { id: 'diger', label: 'Diğer', emoji: '✨' },
];

// Çalışma hedefi seçenekleri (dakika)
const STUDY_TARGETS = [
  { value: 30, label: '30 dk', subtitle: 'Yeni başlayan' },
  { value: 60, label: '1 saat', subtitle: 'Hafif tempo' },
  { value: 120, label: '2 saat', subtitle: 'Orta tempo' },
  { value: 180, label: '3 saat', subtitle: 'Yoğun tempo' },
  { value: 240, label: '4+ saat', subtitle: 'Maraton' },
];

export default function CompleteProfileScreen() {
  const { user, token, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [age, setAge] = useState('');
  const [occupation, setOccupation] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [dailyTarget, setDailyTarget] = useState<number | null>(null);

  const totalSteps = 3;

  const canProceed = () => {
    switch (step) {
      case 1:
        return age.trim() !== '' && occupation.trim() !== '';
      case 2:
        return selectedGoal !== null;
      case 3:
        return dailyTarget !== null;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !token) {
      Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
      return;
    }

    setIsLoading(true);
    try {
      const goalLabel = GOALS.find((g) => g.id === selectedGoal)?.label || '';

      const updatedUser = await updateProfile(
        user.id,
        {
          age: parseInt(age, 10),
          occupation: occupation.trim(),
          goal: goalLabel,
          daily_study_target: dailyTarget!,
        },
        token
      );

      updateUser(updatedUser);

      // Ana sayfaya yönlendir
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Profil güncellenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.stepRow}>
          <View
            style={[
              styles.stepDot,
              s === step && styles.stepDotActive,
              s < step && styles.stepDotCompleted,
            ]}
          >
            {s < step ? (
              <Text style={styles.stepCheck}>✓</Text>
            ) : (
              <Text style={[styles.stepNumber, s === step && styles.stepNumberActive]}>
                {s}
              </Text>
            )}
          </View>
          {s < 3 && (
            <View style={[styles.stepLine, s < step && styles.stepLineCompleted]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Seni Tanıyalım 👋</Text>
      <Text style={styles.stepSubtitle}>
        Sana en uygun deneyimi sunabilmemiz için birkaç bilgiye ihtiyacımız var
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Yaşın</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🎂</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: 22"
            placeholderTextColor={PersonaSyncColors.gray}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Mesleğin / Okulun</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🎒</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Bilgisayar Mühendisliği Öğrencisi"
            placeholderTextColor={PersonaSyncColors.gray}
            value={occupation}
            onChangeText={setOccupation}
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Hedefin Ne? 🎯</Text>
      <Text style={styles.stepSubtitle}>
        PersonaSync'i hangi amaçla kullanmak istiyorsun?
      </Text>

      <View style={styles.goalsGrid}>
        {GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[
              styles.goalCard,
              selectedGoal === goal.id && styles.goalCardSelected,
            ]}
            onPress={() => setSelectedGoal(goal.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            <Text
              style={[
                styles.goalLabel,
                selectedGoal === goal.id && styles.goalLabelSelected,
              ]}
            >
              {goal.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Günlük Hedefin ⏰</Text>
      <Text style={styles.stepSubtitle}>
        Her gün ne kadar çalışmayı hedefliyorsun?
      </Text>

      <View style={styles.targetsContainer}>
        {STUDY_TARGETS.map((target) => (
          <TouchableOpacity
            key={target.value}
            style={[
              styles.targetCard,
              dailyTarget === target.value && styles.targetCardSelected,
            ]}
            onPress={() => setDailyTarget(target.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.targetLabel,
                dailyTarget === target.value && styles.targetLabelSelected,
              ]}
            >
              {target.label}
            </Text>
            <Text
              style={[
                styles.targetSubtitle,
                dailyTarget === target.value && styles.targetSubtitleSelected,
              ]}
            >
              {target.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tipContainer}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipText}>
          Başlangıçta küçük hedefler belirleyip zamanla artırmak daha etkilidir!
        </Text>
      </View>
    </View>
  );

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
          <Text style={styles.headerTitle}>Profilini Tamamla</Text>
          {renderStepIndicator()}
        </View>

        {/* Form Card */}
        <View style={styles.formContainer}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>← Geri</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                !canProceed() && styles.nextButtonDisabled,
                step === 1 && styles.nextButtonFull,
              ]}
              onPress={handleNext}
              disabled={!canProceed() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={PersonaSyncColors.white} />
              ) : (
                <Text style={styles.nextButtonText}>
                  {step === totalSteps ? 'Tamamla 🚀' : 'Devam →'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Text */}
        <Text style={styles.progressText}>
          {step} / {totalSteps} adım tamamlandı
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
    marginBottom: Spacing.lg,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PersonaSyncColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PersonaSyncColors.secondary,
  },
  stepDotActive: {
    backgroundColor: PersonaSyncColors.accent,
    borderColor: PersonaSyncColors.accent,
  },
  stepDotCompleted: {
    backgroundColor: PersonaSyncColors.success,
    borderColor: PersonaSyncColors.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: PersonaSyncColors.secondary,
  },
  stepNumberActive: {
    color: PersonaSyncColors.white,
  },
  stepCheck: {
    fontSize: 16,
    color: PersonaSyncColors.white,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: PersonaSyncColors.primaryLight,
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: PersonaSyncColors.success,
  },
  formContainer: {
    backgroundColor: PersonaSyncColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  stepContent: {
    minHeight: 280,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: PersonaSyncColors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    fontSize: 14,
    color: PersonaSyncColors.darkGray,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
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
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  goalCard: {
    width: '48%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: PersonaSyncColors.offWhite,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: PersonaSyncColors.lightGray,
    alignItems: 'center',
  },
  goalCardSelected: {
    borderColor: PersonaSyncColors.accent,
    backgroundColor: PersonaSyncColors.accent + '10',
  },
  goalEmoji: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PersonaSyncColors.charcoal,
    textAlign: 'center',
  },
  goalLabelSelected: {
    color: PersonaSyncColors.accent,
  },
  targetsContainer: {
    gap: Spacing.sm,
  },
  targetCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: PersonaSyncColors.offWhite,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: PersonaSyncColors.lightGray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetCardSelected: {
    borderColor: PersonaSyncColors.accent,
    backgroundColor: PersonaSyncColors.accent + '10',
  },
  targetLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PersonaSyncColors.charcoal,
  },
  targetLabelSelected: {
    color: PersonaSyncColors.accent,
  },
  targetSubtitle: {
    fontSize: 14,
    color: PersonaSyncColors.gray,
  },
  targetSubtitleSelected: {
    color: PersonaSyncColors.accentDark,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PersonaSyncColors.info + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  tipEmoji: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: PersonaSyncColors.info,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  backButton: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: PersonaSyncColors.lightGray,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PersonaSyncColors.darkGray,
  },
  nextButton: {
    flex: 2,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: PersonaSyncColors.accent,
    ...Shadows.md,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: PersonaSyncColors.gray,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PersonaSyncColors.white,
  },
  progressText: {
    fontSize: 14,
    color: PersonaSyncColors.secondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});